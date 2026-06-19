import assert from "node:assert/strict";
import { LiveEvent } from "./live/events";
import { PostgresNotifyEventBus, type PgNotifyClient } from "./live/pg-bus";

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

async function main(): Promise<void> {
  console.log("Omni3D — EventBus broadcaster\n");
  await fakeCrossInstance();
  await liveIntegration();
  console.log("\nBUS SMOKE PASS");
}

main().catch((err: unknown) => {
  console.error("BUS SMOKE FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
