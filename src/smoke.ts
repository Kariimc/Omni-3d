import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app";
import { PipelineJob } from "./schemas";
import { MemoryJobStore } from "./store/memory";

const here = dirname(fileURLToPath(import.meta.url));
const JSON_HEADERS = { "content-type": "application/json" };

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

async function createJob(app: FastifyInstance): Promise<PipelineJob> {
  const res = await app.inject({
    method: "POST",
    url: "/pipeline",
    headers: JSON_HEADERS,
    payload: JSON.stringify(createBody),
  });
  assert.equal(res.statusCode, 201, "POST /pipeline -> 201");
  return PipelineJob.parse(res.json());
}

async function main(): Promise<void> {
  const app = await buildApp(new MemoryJobStore());

  // --- basics ---
  const health = await app.inject({ method: "GET", url: "/health" });
  assert.equal(health.statusCode, 200, "health -> 200");

  // Dashboard static assets are served.
  const home = await app.inject({ method: "GET", url: "/" });
  assert.equal(home.statusCode, 200, "GET / -> 200");
  assert.ok(home.headers["content-type"]?.toString().includes("text/html"), "/ is html");
  assert.ok(home.body.includes("OMNI"), "/ renders the dashboard");
  const dashJs = await app.inject({ method: "GET", url: "/dashboard.js" });
  assert.equal(dashJs.statusCode, 200, "GET /dashboard.js -> 200");
  assert.ok(dashJs.body.includes("WebSocket"), "dashboard.js consumes /live");
  assert.ok(dashJs.body.includes("from=") && dashJs.body.includes("lastSeq"), "dashboard.js auto-resumes");
  const dashCss = await app.inject({ method: "GET", url: "/dashboard.css" });
  assert.equal(dashCss.statusCode, 200, "GET /dashboard.css -> 200");

  const job = await createJob(app);
  const id = job.jobId;
  assert.equal(job.runner?.cursor, -1, "new job runner cursor = -1");

  const got = await app.inject({ method: "GET", url: `/jobs/${id}` });
  assert.equal(got.statusCode, 200, "GET /jobs/:id -> 200");

  const missing = await app.inject({ method: "GET", url: "/jobs/job_NOPE" });
  assert.equal(missing.statusCode, 404, "GET unknown -> 404");

  const bad = await app.inject({
    method: "POST",
    url: "/pipeline",
    headers: JSON_HEADERS,
    payload: JSON.stringify({ targets: {} }),
  });
  assert.equal(bad.statusCode, 400, "invalid request -> 400");

  // --- stage validate-and-ack ---
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
  stage.jobId = "job_OTHER";
  const stageBad = await app.inject({
    method: "POST",
    url: `/jobs/${id}/stages`,
    headers: JSON_HEADERS,
    payload: JSON.stringify(stage),
  });
  assert.equal(stageBad.statusCode, 409, "stage jobId mismatch -> 409");

  // --- runner: full A -> B -> C walk ---
  let done = false;
  let steps = 0;
  while (!done && steps < 12) {
    const adv = await app.inject({ method: "POST", url: `/jobs/${id}/advance` });
    assert.equal(adv.statusCode, 200, `advance ${steps} -> 200`);
    done = adv.json().done;
    steps++;
  }
  assert.equal(steps, 6, "six stages advanced");

  const final = (await app.inject({ method: "GET", url: `/jobs/${id}` })).json();
  assert.equal(final.status, "passed", "job passed after full run");
  assert.equal(final.loops.A_structural.status, "passed", "Loop A passed");
  assert.equal(final.loops.B_rigging.status, "passed", "Loop B passed");
  assert.equal(final.loops.C_eitl.status, "passed", "Loop C passed");
  assert.equal(final.runner.cursor, 5, "runner cursor at last stage");

  const stages = (await app.inject({ method: "GET", url: `/jobs/${id}/stages` })).json();
  assert.equal(stages.length, 6, "six stage payloads stored");
  assert.equal(stages[5].$omni3d, "loopC.eitl.validation/v1", "last emitted is EITL");

  const over = await app.inject({ method: "POST", url: `/jobs/${id}/advance` });
  assert.equal(over.statusCode, 409, "advance after complete -> 409");

  // --- EITL micro-repair back-edge ---
  const job2 = await createJob(app);
  const id2 = job2.jobId;
  for (let i = 0; i < 5; i++) {
    await app.inject({ method: "POST", url: `/jobs/${id2}/advance` });
  }
  const cAdv = await app.inject({ method: "POST", url: `/jobs/${id2}/advance?defect=vertex_tear` });
  assert.equal(cAdv.statusCode, 200, "C advance -> 200");
  const eitl = cAdv.json().emitted;
  assert.equal(eitl.microRepair.triggered, true, "micro-repair triggered");
  assert.ok(eitl.microRepair.inpaintPasses >= 1, "at least one inpaint pass");
  assert.equal(eitl.costFunction.passed, true, "EITL passed after repair");
  assert.equal(cAdv.json().status, "passed", "job passed after repair");

  await app.close();
  console.log(
    `SMOKE PASS — routes + runner (A→B→C in ${steps} steps; EITL repair passes=${eitl.microRepair.inpaintPasses})`,
  );
}

main().catch((err: unknown) => {
  console.error("SMOKE FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
