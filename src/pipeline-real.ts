import { buildStageContext, runRealPipeline } from "./loops/real-providers";
import { buildJobEnvelope, CreatePipelineRequest } from "./schemas";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Runs the full pipeline with real providers end-to-end (outside the test harness) and
// prints what each stage actually computed. Toggle the flag to compare with synthetic.
async function main(): Promise<void> {
  const real = process.argv.includes("--synthetic") ? false : true;
  const ctx = await buildStageContext();
  const req = CreatePipelineRequest.parse({
    video: { uri: "asset://uploads/clip.mp4", container: "mp4", durationSec: 5, fps: 30, resolution: [1920, 1080] },
    targets: { engine: "ue5", polyBudget: "mobile_xr", rigStandard: "ue5_sk_mannequin" },
    features: { realPipeline: real },
  });
  const job = buildJobEnvelope(req);

  console.log(`\nOmni3D pipeline — ${real ? "REAL providers" : "synthetic generators"} (job ${job.jobId})\n`);
  const { job: final, payloads } = await runRealPipeline(job, ctx);
  for (const p of payloads) console.log("  •", (p as any).$omni3d);
  console.log(`\nstatus: ${final.status} | EITL repairs: ${final.runner?.repairs} | stages: ${payloads.length}\n`);
}

main().catch((err: unknown) => {
  console.error("pipeline-real failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
