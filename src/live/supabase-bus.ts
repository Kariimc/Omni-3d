import type { EventBus } from "./bus";
import { LiveEvent } from "./events";

export const REALTIME_CHANNEL = "omni3d_live";
const EVENT = "live";

/** Minimal Supabase Realtime channel surface we depend on, so tests can inject a
 *  fake hub. A real RealtimeChannel (db.channel(...)) satisfies this structurally. */
export interface BroadcastChannel {
  on(
    type: "broadcast",
    filter: { event: string },
    cb: (msg: { payload: unknown }) => void,
  ): BroadcastChannel;
  subscribe(cb?: (status: string) => void): BroadcastChannel;
  send(msg: { type: "broadcast"; event: string; payload: unknown }): Promise<unknown> | unknown;
}

/** Multi-instance broadcaster over Supabase Realtime. Every API instance joins one
 *  channel; publish() broadcasts, and the durable log still backs replay. Native fit
 *  for serverless/Supabase deployments (no persistent LISTEN connection required). */
export class SupabaseRealtimeEventBus implements EventBus {
  private listeners = new Map<string, Set<(e: LiveEvent) => void>>();

  constructor(private readonly channel: BroadcastChannel) {
    this.channel.on("broadcast", { event: EVENT }, (msg) => this.onMessage(msg.payload));
  }

  /** Resolves once the channel is SUBSCRIBED. Called once per process by the factory. */
  async start(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.channel.subscribe((status) => {
        if (status === "SUBSCRIBED") resolve();
      });
    });
  }

  publish(jobId: string, event: LiveEvent): void {
    void this.channel.send({ type: "broadcast", event: EVENT, payload: { jobId, event } });
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

  private onMessage(raw: unknown): void {
    if (!raw || typeof raw !== "object") return;
    const { jobId, event } = raw as { jobId?: unknown; event?: unknown };
    let parsed: LiveEvent;
    try {
      parsed = LiveEvent.parse(event);
    } catch {
      return;
    }
    for (const listener of this.listeners.get(String(jobId)) ?? []) listener(parsed);
  }
}
