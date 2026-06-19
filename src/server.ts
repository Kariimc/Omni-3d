import { buildApp } from "./app";
import { config } from "./config";
import { createEventBus } from "./live/factory";
import { createJobStore } from "./store";

const store = createJobStore();

createEventBus()
  .then(async (bus) => {
    const app = await buildApp(store, bus);
    const addr = await app.listen({ port: config.port, host: config.host });
    console.log(`Omni3D API listening on ${addr} (store: ${store.kind}, bus: ${config.eventBus})`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
