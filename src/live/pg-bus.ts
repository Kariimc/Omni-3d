import type { EventBus } from "./bus";
import { LiveEvent } from "./events";

/** Minimal pg client surface we depend on, so tests can inject a fake wire. */
export interface PgNotifyClient {
  query(sql: string, params?: unknown[]): Promise<unknown>;
  on(event: "notification", listener: (msg: { channel: string; payload?: string }) => void): void;
  end?(): Promise<void>;
}

const CHANNEL = "omni3d_live";
const MAX_PAYLOAD = 7800; // Postgres NOTIFY payload cap is 8000 bytes

/** Multi-instance broadcaster over Postgres LISTEN/NOTIFY. Every API instance LISTENs
 *  on one channel; publish() fans an event to all instances (the durable log in the
 *  store remains the source of truth / replay path for late joiners). */
export class PostgresNotifyEventBus implements EventBus {
  private listeners = new Map<string, Set<(e: LiveEvent) => void>>();
  private started = false;

  constructor(private readonly client: PgNotifyClient) {}

  /** LISTEN on the channel. Called once per process by createEventBus(). */
  async start(): Promise<void> {
    if (this.started) return;
    this.client.on("notification", (msg) => this.onNotify(msg));
    await this.client.query(`LISTEN ${CHANNEL}`);
    this.started = true;
  }

  publish(jobId: string, event: LiveEvent): void {
    const payload = JSON.stringify({ jobId, event });
    if (payload.length > MAX_PAYLOAD) return; // oversized frames are still in the durable log
    void this.client.query("SELECT pg_notify($1, $2)", [CHANNEL, payload]);
  }

  subscribe(jobId: string, listener: (event: LiveEvent) => void): () => void {
    const set = this.listeners.get(jobId) ?? new Set();
    set.add(listener);
    this.listeners.set(jobId, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(jobId);
    };
  }

  private onNotify(msg: { channel: string; payload?: string }): void {
    if (msg.channel !== CHANNEL || !msg.payload) return;
    let jobId: string;
    let event: LiveEvent;
    try {
      const parsed = JSON.parse(msg.payload) as { jobId: string; event: unknown };
      jobId = String(parsed.jobId);
      event = LiveEvent.parse(parsed.event);
    } catch {
      return; // ignore malformed notifications
    }
    for (const listener of this.listeners.get(jobId) ?? []) listener(event);
  }
}
