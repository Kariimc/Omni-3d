import assert from "node:assert/strict";
import { LiveEvent } from "./live/events";
import { PostgresNotifyEventBus, type PgNotifyClient } from "./live/pg-bus";
import {
  type BroadcastChannel,
  REALTIME_CHANNEL,
  SupabaseRealtimeEventBus,
} from "./live/supabase-bus";

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const sample = (jobId: string, seq: number): LiveEvent =>
  LiveEvent.parse({ type: "pipeline.complete", jobId, status: "passed", ts: new Date().toISOString(), seq });

// --- Fake Postgres wire: emulates LISTEN/NOTIFY broadcast across connections ---
type NotifyCb = (msg: { channel: string; payload?: string }) => void;

class FakePgWire {
  private cbs = new Set<NotifyCb>();
  register(cb: NotifyCb): void {
    this.cbs.add(cb);
  }
  broadcast(channel: string, payload: string): void {
    for (const cb of this.cbs) cb({ channel, payload });
  }
}

class FakePgClient implements PgNotifyClient {
  constructor(private readonly wire: FakePgWire) {}
  async query(sql: string, params?: unknown[]): Promise<unknown> {
    if (sql.includes("pg_notify") && params) {
      this.wire.broadcast(String(params[0]), String(params[1]));
    }
    return { rows: [] };
  }
  on(_event: "notification", listener: NotifyCb): void {
    this.wire.register(listener);
  }
  async end(): Promise<void> {}
}

async function fakeCrossInstance(): Promise<void> {
  const wire = new FakePgWire();
  const busA = new PostgresNotifyEventBus(new FakePgClient(wire));
  const busB = new PostgresNotifyEventBus(new FakePgClient(wire));
  await busA.start();
  await busB.start();

  const onB: LiveEvent[] = [];
  const onOther: LiveEvent[] = [];
  busB.subscribe("job_X", (e) => onB.push(e));
  const off = busB.subscribe("job_Y", (e) => onOther.push(e));

  busA.publish("job_X", sample("job_X", 1)); // instance A -> DB -> instance B
  await delay(0);
  assert.equal(onB.length, 1, "cross-instance delivery A -> B");
  assert.equal(onB[0]?.type, "pipeline.complete", "event survives the wire intact");
  assert.equal(onOther.length, 0, "events are filtered by jobId");

  off();
  busA.publish("job_Y", sample("job_Y", 2));
  await delay(0);
  assert.equal(onOther.length, 0, "unsubscribe stops delivery");

  console.log("  ✓ fake cross-instance fan-out (A→DB→B), jobId filtering, unsubscribe");
}

async function liveIntegration(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("  ⤼ live Postgres test skipped (set DATABASE_URL to run)");
    return;
  }
  const { Client } = await import("pg");
  const a = new Client({ connectionString: url });
  const b = new Client({ connectionString: url });
  await a.connect();
  await b.connect();
  const busA = new PostgresNotifyEventBus(a as unknown as PgNotifyClient);
  const busB = new PostgresNotifyEventBus(b as unknown as PgNotifyClient);
  await busA.start();
  await busB.start();
  await delay(50);

  const received = new Promise<LiveEvent>((resolve) => busB.subscribe("job_live", resolve));
  busA.publish("job_live", sample("job_live", 1));
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout waiting for NOTIFY")), 3000);
  });
  const ev = await Promise.race([received, timeout]);
  clearTimeout(timer!);
  assert.equal(ev.type, "pipeline.complete", "live NOTIFY delivered cross-connection");
  await a.end();
  await b.end();
  console.log("  ✓ live Postgres LISTEN/NOTIFY cross-connection delivery");
}

// --- Fake Supabase Realtime hub: emulates broadcast fan-out across channels ---
class FakeRealtimeHub {
  private subs = new Set<(payload: unknown) => void>();
  join(fn: (payload: unknown) => void): void {
    this.subs.add(fn);
  }
  broadcast(payload: unknown): void {
    for (const fn of this.subs) fn(payload);
  }
}

class FakeChannel implements BroadcastChannel {
  private cb?: (msg: { payload: unknown }) => void;
  constructor(private readonly hub: FakeRealtimeHub) {}
  on(_t: "broadcast", _f: { event: string }, cb: (msg: { payload: unknown }) => void): BroadcastChannel {
    this.cb = cb;
    this.hub.join((payload) => this.cb?.({ payload }));
    return this;
  }
  subscribe(cb?: (status: string) => void): BroadcastChannel {
    cb?.("SUBSCRIBED");
    return this;
  }
  send(msg: { type: "broadcast"; event: string; payload: unknown }): Promise<unknown> {
    this.hub.broadcast(msg.payload);
    return Promise.resolve("ok");
  }
}

async function realtimeFakeCrossInstance(): Promise<void> {
  const hub = new FakeRealtimeHub();
  const busA = new SupabaseRealtimeEventBus(new FakeChannel(hub));
  const busB = new SupabaseRealtimeEventBus(new FakeChannel(hub));
  await busA.start();
  await busB.start();

  const onB: LiveEvent[] = [];
  busB.subscribe("job_R", (e) => onB.push(e));
  busA.publish("job_R", sample("job_R", 1));
  await delay(0);
  assert.equal(onB.length, 1, "realtime cross-instance delivery A -> B");
  assert.equal(onB[0]?.type, "pipeline.complete", "event survives realtime intact");
  console.log("  ✓ fake Supabase Realtime fan-out (A→hub→B)");
}

async function liveRealtime(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.log("  ⤼ live Supabase Realtime test skipped (set SUPABASE_URL + SUPABASE_SERVICE_KEY)");
    return;
  }
  const { createClient } = await import("@supabase/supabase-js");
  const channel = (): BroadcastChannel => {
    const db = createClient(url, key, { auth: { persistSession: false } });
    return db.channel(REALTIME_CHANNEL, { config: { broadcast: { self: true } } }) as unknown as BroadcastChannel;
  };
  const busA = new SupabaseRealtimeEventBus(channel());
  const busB = new SupabaseRealtimeEventBus(channel());
  await busA.start();
  await busB.start();
  await delay(250);

  const received = new Promise<LiveEvent>((resolve) => busB.subscribe("job_rt", resolve));
  busA.publish("job_rt", sample("job_rt", 1));
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout waiting for realtime")), 5000);
  });
  const ev = await Promise.race([received, timeout]);
  clearTimeout(timer!);
  assert.equal(ev.type, "pipeline.complete", "live Supabase Realtime delivered cross-instance");
  console.log("  ✓ live Supabase Realtime cross-instance delivery");
}

async function main(): Promise<void> {
  console.log("Omni3D — EventBus broadcaster\n");
  await fakeCrossInstance();
  await realtimeFakeCrossInstance();
  await liveIntegration();
  await liveRealtime();
  console.log("\nBUS SMOKE PASS");
}

main().catch((err: unknown) => {
  console.error("BUS SMOKE FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
