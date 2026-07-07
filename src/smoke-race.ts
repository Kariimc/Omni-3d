/** Wargame 07 probe — suspect #2: concurrent POST /jobs/:id/advance race.
 *  Fires two concurrent advances per step against one job over a REAL listening
 *  server (app.inject can serialize; real HTTP interleaves at await boundaries).
 *  Correct behavior: 6 distinct stages in canonical order, cursor 0..5, no dupes. */
import { buildApp } from "./app";
import { MemoryJobStore } from "./store/memory";

const REQ = {
  text: "probe",
  video: { uri: "asset://uploads/probe.mp4", container: "mp4", durationSec: 2.0, fps: 30, resolution: [640, 360] },
  targets: { engine: "ue5", unitScale: "cm", polyBudget: "hero", humanoid: true, rigStandard: "ue5_sk_mannequin" },
};

const CANONICAL = [
  "loopA.frameSampler.out/v1",
  "loopA.voxelDraft/v1",
  "loopA.retopology.io/v1",
  "loopB.rigging.skinWeights/v1",
  "loopB.animation.retarget/v1",
  "loopC.eitl.validation/v1",
];

async function runOnce(base: string): Promise<{ stages: string[]; dupes: number; statuses: number[] }> {
  const create = await fetch(`${base}/pipeline`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(REQ),
  });
  const job = (await create.json()) as { jobId: string };
  const statuses: number[] = [];
  // Drive to completion firing PAIRS of concurrent advances.
  for (let i = 0; i < 8; i++) {
    const [a, b] = await Promise.all([
      fetch(`${base}/jobs/${job.jobId}/advance`, { method: "POST" }),
      fetch(`${base}/jobs/${job.jobId}/advance`, { method: "POST" }),
    ]);
    statuses.push(a.status, b.status);
  }
  const stagesRes = await fetch(`${base}/jobs/${job.jobId}/stages`);
  const stages = ((await stagesRes.json()) as { $omni3d: string }[]).map((s) => s.$omni3d);
  const dupes = stages.length - new Set(stages).size;
  return { stages, dupes, statuses };
}

async function main(): Promise<void> {
  const app = await buildApp(new MemoryJobStore());
  const addr = await app.listen({ port: 0, host: "127.0.0.1" });
  console.log("Omni3D — concurrency probe (suspect #2)\n");
  let raceHits = 0;
  let worst: string[] = [];
  const RUNS = 20;
  for (let r = 0; r < RUNS; r++) {
    const { stages, dupes } = await runOnce(addr);
    const orderOk = JSON.stringify(stages) === JSON.stringify(CANONICAL);
    if (dupes > 0 || !orderOk || stages.length !== 6) {
      raceHits++;
      if (stages.length > worst.length || dupes > 0) worst = stages;
    }
  }
  await app.close();
  if (raceHits > 0) {
    console.log(`  ✗ RACE CONFIRMED in ${raceHits}/${RUNS} runs`);
    console.log(`    worst stage log (${worst.length} entries): ${worst.join(" | ")}`);
    process.exit(1);
  }
  console.log(`  ✓ ${RUNS}/${RUNS} runs: exactly 6 stages, canonical order, no duplicates`);
  console.log("\nRACE PROBE PASS (no race observed)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
