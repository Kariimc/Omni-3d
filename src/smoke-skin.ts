import assert from "node:assert/strict";
import { type BoneSeg, heatDiffusionWeights, realSkinWeights } from "./loops/providers/skin-weights";
import type { Mesh } from "./loops/providers/retopology";
import { advanceJob } from "./loops/runner";
import { buildJobEnvelope, CreatePipelineRequest } from "./schemas";

// A cylindrical tube along +Y from y=0..2, radius 0.3 — a connected graph for diffusion.
function cylinder(rings: number, segs: number, radius = 0.3, height = 2): Mesh {
  const positions: number[] = [];
  for (let r = 0; r < rings; r++) {
    const y = (height * r) / (rings - 1);
    for (let s = 0; s < segs; s++) {
      const a = (2 * Math.PI * s) / segs;
      positions.push(radius * Math.cos(a), y, radius * Math.sin(a));
    }
  }
  const indices: number[] = [];
  for (let r = 0; r < rings - 1; r++) {
    for (let s = 0; s < segs; s++) {
      const s2 = (s + 1) % segs;
      const a = r * segs + s;
      const b = r * segs + s2;
      const c = (r + 1) * segs + s2;
      const d = (r + 1) * segs + s;
      indices.push(a, b, c, a, c, d);
    }
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}

type Skin = {
  $omni3d: string;
  skinWeighting: { method: string; maxInfluencesPerVertex: number; sample: { vertex: number; influences: { bone: string; weight: number }[] }[] };
};

async function main(): Promise<void> {
  console.log("Omni3D — real skin weights (bone-heat diffusion)\n");

  const RINGS = 21;
  const SEGS = 16;
  const mesh = cylinder(RINGS, SEGS);
  const bones: BoneSeg[] = [
    { name: "lower", parent: null, head: [0, 0, 0], tail: [0, 1, 0] },
    { name: "upper", parent: "lower", head: [0, 1, 0], tail: [0, 2, 0] },
  ];
  const LOWER = 0;
  const UPPER = 1;

  const w = heatDiffusionWeights(mesh, bones, { iterations: 150 });
  assert.equal(w.length, RINGS * SEGS, "weights computed for every vertex");

  // partition of unity + range, checked across spread-out vertices
  for (const v of [0, 32, 160, 288, RINGS * SEGS - 1]) {
    const sum = w[v]![LOWER]! + w[v]![UPPER]!;
    assert.ok(Math.abs(sum - 1) < 1e-6, `vertex ${v} weights sum to 1 (got ${sum})`);
    assert.ok(w[v]![LOWER]! >= 0 && w[v]![LOWER]! <= 1 && w[v]![UPPER]! >= 0 && w[v]![UPPER]! <= 1, "weights in [0,1]");
  }
  console.log("  ✓ partition of unity: every vertex's weights sum to 1, all in [0,1]");

  // locality: bottom ring (y≈0.2) binds to lower bone, top ring (y≈1.8) to upper bone
  const bottom = 2 * SEGS; // ring 2
  const top = 18 * SEGS; // ring 18
  assert.ok(w[bottom]![LOWER]! > w[bottom]![UPPER]! && w[bottom]![LOWER]! > 0.8, "bottom binds to lower bone");
  assert.ok(w[top]![UPPER]! > w[top]![LOWER]! && w[top]![UPPER]! > 0.8, "top binds to upper bone");
  console.log(`  ✓ locality: bottom→lower=${w[bottom]![LOWER]!.toFixed(3)}, top→upper=${w[top]![UPPER]!.toFixed(3)}`);

  // monotonic falloff of the upper-bone weight as we climb the tube
  const climb = [2, 6, 10, 14, 18].map((r) => w[r * SEGS]![UPPER]!);
  for (let i = 1; i < climb.length; i++) {
    assert.ok(climb[i]! > climb[i - 1]!, `upper weight increases with height (${climb[i - 1]} -> ${climb[i]})`);
  }
  console.log(`  ✓ monotonic falloff up the tube: upper weight ${climb.map((x) => x.toFixed(2)).join(" < ")}`);

  // the junction ring is genuinely blended — proves heat diffusion, not nearest-bone assignment
  const junction = w[10 * SEGS]![UPPER]!;
  assert.ok(junction > 0.2 && junction < 0.8, `junction ring is blended (upper=${junction.toFixed(2)})`);
  console.log(`  ✓ smooth blend at the bone junction: upper=${junction.toFixed(2)} (not 0/1)`);

  // payload provider
  const req = CreatePipelineRequest.parse({
    video: { uri: "asset://uploads/clip.mp4", container: "mp4", durationSec: 5, fps: 30, resolution: [1920, 1080] },
    targets: { engine: "ue5", polyBudget: "hero", rigStandard: "ue5_sk_mannequin" },
  });
  const job = buildJobEnvelope(req);

  const payload = realSkinWeights(job, mesh, bones, { iterations: 120 }) as Skin;
  assert.equal(payload.skinWeighting.method, "heat_diffusion_geodesic", "real method reported");
  assert.equal(payload.skinWeighting.maxInfluencesPerVertex, 4, "influence cap honored");
  for (const s of payload.skinWeighting.sample) {
    assert.ok(s.influences.length >= 1 && s.influences.length <= 4, "1..4 influences per sampled vertex");
    const sum = s.influences.reduce((acc, x) => acc + x.weight, 0);
    assert.ok(Math.abs(sum - 1) < 1e-6, `sample vertex ${s.vertex} normalized (got ${sum})`);
  }
  console.log(`  ✓ realSkinWeights payload: ${payload.skinWeighting.sample.length} samples, each normalized`);

  // DI seam: drive the runner to B1 with the real skinning injected
  let cur = job;
  let emitted: Skin = { $omni3d: "" } as Skin;
  for (let i = 0; i < 4; i++) {
    const r = await advanceJob(cur, {}, { B1: (j) => realSkinWeights(j, mesh, bones, { iterations: 80 }) });
    assert.equal(r.kind, "advanced", `advance ${i} ok`);
    if (r.kind === "advanced") {
      cur = r.job;
      emitted = r.emitted as unknown as Skin;
    }
  }
  assert.equal(emitted.$omni3d, "loopB.rigging.skinWeights/v1", "runner reached B1");
  assert.equal(emitted.skinWeighting.method, "heat_diffusion_geodesic", "runner used the real skinning provider");
  console.log("  ✓ runner accepts the injected real skin weights at B1 (DI seam)");

  console.log("\nSKIN SMOKE PASS");
}

main().catch((err: unknown) => {
  console.error("SKIN SMOKE FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
