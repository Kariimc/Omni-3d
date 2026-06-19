import { config } from "../config";
import { InMemoryEventBus, type EventBus } from "./bus";
import { PostgresNotifyEventBus, type PgNotifyClient } from "./pg-bus";

/** Select the broadcaster from the environment: Postgres LISTEN/NOTIFY when
 *  EVENT_BUS=pg and DATABASE_URL is set (multi-instance), else in-memory. */
export async function createEventBus(): Promise<EventBus> {
  if (config.eventBus === "pg" && config.databaseUrl) {
    const { Client } = await import("pg");
    const client = new Client({ connectionString: config.databaseUrl });
    await client.connect();
    const bus = new PostgresNotifyEventBus(client as unknown as PgNotifyClient);
    await bus.start();
    return bus;
  }
  return new InMemoryEventBus();
}
