import assert from "node:assert/strict";
import { type Mesh, realRetopology, simplifyMesh, uvSphere } from "./loops/providers/retopology";
import { advanceJob } from "./loops/runner";
import { buildJobEnvelope, CreatePipelineRequest } from "./schemas";

async function main(): Promise<void> {
  console.log("Omni3D — real Retopology (meshoptimizer decimation)\n");

  const mesh: Mesh = uvSphere(200, 200); // ~80k triangles
  const inputTris = mesh.indices.length / 3;

  // 1) raw decimation reduces the triangle count toward the target
  const dec = await simplifyMesh(mesh, 10000);
  assert.equal(dec.inputTris, inputTris, "reports input triangle count");
  assert.ok(dec.outputTris < inputTris * 0.6, "decimation cut the triangle count");
  assert.ok(dec.outputTris <= 12000, "decimated near the 10k-tri target");
  console.log(`  ✓ simplify ${inputTris} → ${dec.outputTris} tris (err=${dec.error.toFixed(4)})`);

  // 2) provider emits a valid Retopology payload with real poly counts
  const req = CreatePipelineRequest.parse({
    video: { uri: "asset://uploads/clip.mp4", container: "mp4", durationSec: 5, fps: 30, resolution: [1920, 1080] },
    targets: { engine: "ue5", polyBudget: "mobile_xr", rigStandard: "ue5_sk_mannequin" },
  });
  const job = buildJobEnvelope(req);
  const payload = (await realRetopology(job, mesh)) as {
    $omni3d: string;
    input: { triangles: number };
    polyBudget: { preset: string; targetQuads: number; achievedQuads: number };
  };
  assert.equal(payload.$omni3d, "loopA.retopology.io/v1", "valid Retopology payload");
  assert.equal(payload.input.triangles, inputTris, "reports real input triangles");
  assert.equal(payload.polyBudget.preset, "mobile_xr");
  assert.ok(payload.polyBudget.achievedQuads < inputTris / 2, "achieved below input");
  assert.ok(payload.polyBudget.achievedQuads <= payload.polyBudget.targetQuads * 1.5, "achieved near budget");
  console.log(
    `  ✓ realRetopology: ${payload.input.triangles} tris → ${payload.polyBudget.achievedQuads} quads (target ${payload.polyBudget.targetQuads})`,
  );

  // 3) DI seam: drive the runner to A3 with the real provider injected
  let cur = job;
  let emitted: { $omni3d: string; input?: { triangles: number } } = { $omni3d: "" };
  for (let i = 0; i < 3; i++) {
    const res = await advanceJob(cur, {}, { A3: (j) => realRetopology(j, mesh) });
    assert.equal(res.kind, "advanced", `advance ${i} ok`);
    if (res.kind === "advanced") {
      cur = res.job;
      emitted = res.emitted as typeof emitted;
    }
  }
  assert.equal(emitted.$omni3d, "loopA.retopology.io/v1", "runner reached A3");
  assert.equal(emitted.input?.triangles, inputTris, "runner used the real decimation provider");
  console.log("  ✓ runner accepts the injected real provider at A3 (DI seam)");

  console.log("\nRETOPO SMOKE PASS");
}

main().catch((err: unknown) => {
  console.error("RETOPO SMOKE FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
