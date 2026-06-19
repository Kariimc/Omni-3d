import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { SCHEMAS } from "./schemas";
import { LiveEvent } from "./live/events";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "..", "schemas", "json");
mkdirSync(OUT, { recursive: true });

const fileFor = (id: string) => id.replace(/\//g, "_").replace(/\./g, "-") + ".schema.json";

const registry = SCHEMAS as Record<string, ZodTypeAny>;
let count = 0;

console.log("Omni3D — exporting JSON Schema for UE5/Unity bridges\n");
for (const [id, schema] of Object.entries(registry)) {
  const jsonSchema = zodToJsonSchema(schema, { name: id, $refStrategy: "none" });
  const out = join(OUT, fileFor(id));
  writeFileSync(out, JSON.stringify(jsonSchema, null, 2) + "\n");
  console.log(`  wrote schemas/json/${fileFor(id)}`);
  count++;
}
const liveOut = join(OUT, "live-event.schema.json");
writeFileSync(
  liveOut,
  JSON.stringify(zodToJsonSchema(LiveEvent, { name: "LiveEvent", $refStrategy: "none" }), null, 2) + "\n",
);
console.log("  wrote schemas/json/live-event.schema.json");
count++;

console.log(`\n${count} JSON Schema file(s) exported.`);
