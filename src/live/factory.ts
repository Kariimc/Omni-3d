import { config } from "../config";
import { InMemoryEventBus, type EventBus } from "./bus";
import { PostgresNotifyEventBus, type PgNotifyClient } from "./pg-bus";
import { type BroadcastChannel, REALTIME_CHANNEL, SupabaseRealtimeEventBus } from "./supabase-bus";

/** Select the broadcaster from the environment:
 *  - EVENT_BUS=pg        -> Postgres LISTEN/NOTIFY (needs DATABASE_URL, direct conn)
 *  - EVENT_BUS=supabase  -> Supabase Realtime (needs SUPABASE_URL + service key)
 *  - otherwise           -> in-memory (single instance) */
export async function createEventBus(): Promise<EventBus> {
  if (config.eventBus === "pg" && config.databaseUrl) {
    const { Client } = await import("pg");
    const client = new Client({ connectionString: config.databaseUrl });
    await client.connect();
    const bus = new PostgresNotifyEventBus(client as unknown as PgNotifyClient);
    await bus.start();
    return bus;
  }

  if (config.eventBus === "supabase" && config.supabase.url && config.supabase.serviceKey) {
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: { persistSession: false },
    });
    const channel = db.channel(REALTIME_CHANNEL, { config: { broadcast: { self: true } } });
    const bus = new SupabaseRealtimeEventBus(channel as unknown as BroadcastChannel);
    await bus.start();
    return bus;
  }

  return new InMemoryEventBus();
}
