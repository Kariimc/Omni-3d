import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ZodTypeAny } from "zod";
import { SCHEMAS, STAGE_CHAIN } from "./schemas";

const here = dirname(fileURLToPath(import.meta.url));
const PAYLOAD_DIR = join(here, "..", "docs", "payloads");

type AnyPayload = { $omni3d: string; nextStage?: string | null };

const registry = SCHEMAS as Record<string, ZodTypeAny>;
let failures = 0;

console.log("Omni3D — payload validation (Zod source of truth)\n");

const byId: Record<string, AnyPayload> = {};
const files = readdirSync(PAYLOAD_DIR).filter((f) => f.endsWith(".json")).sort();

for (const file of files) {
  const data = JSON.parse(readFileSync(join(PAYLOAD_DIR, file), "utf8")) as AnyPayload;
  byId[data.$omni3d] = data;
  const schema = registry[data.$omni3d];
  if (!schema) {
    console.log(`  ✗ ${file}: unknown $omni3d "${data.$omni3d}"`);
    failures++;
    continue;
  }
  const res = schema.safeParse(data);
  if (res.success) {
    console.log(`  ✓ ${file}  (${data.$omni3d})`);
  } else {
    failures++;
    console.log(`  ✗ ${file}  (${data.$omni3d})`);
    for (const issue of res.error.issues) {
      console.log(`      ${issue.path.join(".") || "<root>"}: ${issue.message}`);
    }
  }
}

// Loop-engineering check: confirm the A -> B -> C nextStage wiring is unbroken.
console.log("\nClosed-loop chain (nextStage wiring):");
for (const step of STAGE_CHAIN) {
  const p = byId[step.id];
  if (!p) {
    console.log(`  ✗ missing payload ${step.id}`);
    failures++;
    continue;
  }
  const got = p.nextStage ?? null;
  if (got === step.nextStage) {
    console.log(`  ✓ ${step.id} → ${step.nextStage ?? "(terminal)"}`);
  } else {
    failures++;
    console.log(`  ✗ ${step.id} nextStage="${got}" expected "${step.nextStage}"`);
  }
}

console.log("");
if (failures > 0) {
  console.error(`FAILED: ${failures} issue(s)`);
  process.exit(1);
}
console.log("PASS — all payloads valid and the 3-loop chain is conformant.");
