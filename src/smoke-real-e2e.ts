import assert from "node:assert/strict";
import { buildStageContext, runRealPipeline } from "./loops/real-providers";
import { buildJobEnvelope, CreatePipelineRequest } from "./schemas";

function makeJob(realPipeline: boolean) {
  const req = CreatePipelineRequest.parse({
    video: { uri: "asset://uploads/clip.mp4", container: "mp4", durationSec: 5, fps: 30, resolution: [1920, 1080] },
    targets: { engine: "ue5", polyBudget: "mobile_xr", rigStandard: "ue5_sk_mannequin" },
    features: { realPipeline },
  });
  return buildJobEnvelope(req);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function main(): Promise<void> {
  console.log("Omni3D — real end-to-end pipeline through the runner\n");

  const ctx = await buildStageContext();

  // --- real path: every stage runs its real provider ---
  const { job: final, payloads } = await runRealPipeline(makeJob(true), ctx);
  assert.equal(payloads.length, 6, "all six stages emitted");

  const a1 = payloads[0] as any;
  assert.equal(a1.sfm.solver, "sharpness_only", "A1 ran the real frame sampler");
  assert.ok(a1.selectedFrames.length >= 1, "A1 kept at least one sharp frame");

  const a2 = payloads[1] as any;
  assert.equal(a2.octree.format, "shape_from_silhouette", "A2 ran the real voxel carver");
  assert.ok(a2.octree.occupiedVoxels > 0, "A2 carved a non-empty hull");

  const a3 = payloads[2] as any;
  assert.equal(a3.input.triangles, 20480, "A3 decimated the real icosphere (20,480 tris)");
  assert.ok(a3.polyBudget.achievedQuads * 2 < a3.input.triangles, "A3 actually reduced the mesh");

  const b1 = payloads[3] as any;
  assert.equal(b1.skinWeighting.method, "heat_diffusion_geodesic", "B1 ran real bone-heat skinning");
  assert.ok(b1.skinWeighting.sample.length >= 1, "B1 produced weight samples");

  const b2 = payloads[4] as any;
  assert.equal(b2.retarget.ikSolver, "two_bone_analytic", "B2 ran the real foot-lock retarget");

  const c = payloads[5] as any;
  assert.equal(c.$omni3d, "loopC.eitl.validation/v1", "C ran the real EITL gate");
  assert.equal(c.costFunction.passed, true, "watertight mesh passes EITL");

  assert.equal(final.status, "passed", "pipeline completed with status passed");
  console.log("  ✓ real run: 6 real stages → status passed");
  console.log(
    `      A1 kept ${a1.selectedFrames.length}/${a1.selectedFrames.length + a1.rejectedFrames.length} frames | ` +
      `A2 ${a2.octree.occupiedVoxels} voxels | A3 ${a3.input.triangles}→${a3.polyBudget.achievedQuads * 2} tris | ` +
      `B1 ${b1.skinWeighting.method} | B2 slide ${b2.retarget.footLock.slideResidualCm}cm | ` +
      `C E=${c.costFunction.score}`,
  );

  // --- the flag gates it: with realPipeline off, the same driver runs synthetic ---
  const synth = await runRealPipeline(makeJob(false), ctx);
  assert.equal((synth.payloads[1] as any).octree.format, "sparse_voxel_octree", "flag off → synthetic A2");
  assert.notEqual((synth.payloads[0] as any).sfm.solver, "sharpness_only", "flag off → synthetic A1");
  console.log("  ✓ feature flag gates real vs synthetic (same runner, same loop chain)");

  console.log("\nE2E SMOKE PASS");
}

main().catch((err: unknown) => {
  console.error("E2E SMOKE FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
