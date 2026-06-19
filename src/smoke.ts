import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app";
import { PipelineJob } from "./schemas";
import { MemoryJobStore } from "./store/memory";

const here = dirname(fileURLToPath(import.meta.url));
const JSON_HEADERS = { "content-type": "application/json" };

async function main(): Promise<void> {
  const app = buildApp(new MemoryJobStore());

  const health = await app.inject({ method: "GET", url: "/health" });
  assert.equal(health.statusCode, 200, "health -> 200");

  const createBody = {
    text: "weathered bronze knight statue, glowing blue rune gems",
    video: {
      uri: "asset://uploads/orbit_pan.mp4",
      container: "mp4",
      durationSec: 12.4,
      fps: 30,
      resolution: [1920, 1080],
    },
    targets: { engine: "ue5", polyBudget: "hero", rigStandard: "ue5_sk_mannequin" },
    features: { kitbash: false },
  };
  const created = await app.inject({
    method: "POST",
    url: "/pipeline",
    headers: JSON_HEADERS,
    payload: JSON.stringify(createBody),
  });
  assert.equal(created.statusCode, 201, "POST /pipeline -> 201");
  const job = PipelineJob.parse(created.json()); // response must satisfy the canonical schema
  const id = job.jobId;

  const got = await app.inject({ method: "GET", url: `/jobs/${id}` });
  assert.equal(got.statusCode, 200, "GET /jobs/:id -> 200");
  assert.equal(got.json().jobId, id, "GET returns the same job");

  const list = await app.inject({ method: "GET", url: "/jobs" });
  assert.equal(list.statusCode, 200, "GET /jobs -> 200");
  assert.equal(list.json().length, 1, "list contains exactly the created job");

  const missing = await app.inject({ method: "GET", url: "/jobs/job_NOPE" });
  assert.equal(missing.statusCode, 404, "GET unknown -> 404");

  const bad = await app.inject({
    method: "POST",
    url: "/pipeline",
    headers: JSON_HEADERS,
    payload: JSON.stringify({ targets: {} }),
  });
  assert.equal(bad.statusCode, 400, "invalid request -> 400");

  // Stage validation via the discriminated union (reuse the canonical example, retag jobId).
  const stage = JSON.parse(
    readFileSync(join(here, "..", "docs", "payloads", "stageA1.frame_sampler.json"), "utf8"),
  );
  stage.jobId = id;
  const stageOk = await app.inject({
    method: "POST",
    url: `/jobs/${id}/stages`,
    headers: JSON_HEADERS,
    payload: JSON.stringify(stage),
  });
  assert.equal(stageOk.statusCode, 200, "POST stage -> 200");
  assert.equal(stageOk.json().stage, "loopA.frameSampler.out/v1", "stage tag echoed");

  stage.jobId = "job_OTHER";
  const stageBad = await app.inject({
    method: "POST",
    url: `/jobs/${id}/stages`,
    headers: JSON_HEADERS,
    payload: JSON.stringify(stage),
  });
  assert.equal(stageBad.statusCode, 409, "stage jobId mismatch -> 409");

  await app.close();
  console.log("SMOKE PASS — /health /pipeline /jobs /jobs/:id /jobs/:id/stages");
}

main().catch((err: unknown) => {
  console.error("SMOKE FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
