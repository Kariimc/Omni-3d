import { buildApp } from "./app";
import { config } from "./config";
import { createJobStore } from "./store";

const store = createJobStore();
const app = buildApp(store);

app
  .listen({ port: config.port, host: config.host })
  .then((addr) => console.log(`Omni3D API listening on ${addr} (store: ${store.kind})`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
