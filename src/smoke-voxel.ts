import assert from "node:assert/strict";
import {
  carveVisualHull,
  countOccupied,
  gridContains,
  gridEquals,
  projectSilhouette,
  realVoxelDraft,
  type VoxelGrid,
} from "./loops/providers/voxel-carve";
import { advanceJob } from "./loops/runner";
import { buildJobEnvelope, CreatePipelineRequest } from "./schemas";

const RES: [number, number, number] = [32, 32, 32];
const gi = (x: number, y: number, z: number): number => (z * RES[1] + y) * RES[0] + x;

function box(lo: number, hi: number): VoxelGrid {
  const occ = new Uint8Array(RES[0] * RES[1] * RES[2]);
  for (let z = 0; z < RES[2]; z++)
    for (let y = 0; y < RES[1]; y++)
      for (let x = 0; x < RES[0]; x++)
        if (x >= lo && x < hi && y >= lo && y < hi && z >= lo && z < hi) occ[gi(x, y, z)] = 1;
  return { res: RES, occupied: occ };
}

function sphere(c: number, r: number): VoxelGrid {
  const occ = new Uint8Array(RES[0] * RES[1] * RES[2]);
  for (let z = 0; z < RES[2]; z++)
    for (let y = 0; y < RES[1]; y++)
      for (let x = 0; x < RES[0]; x++)
        if ((x - c) ** 2 + (y - c) ** 2 + (z - c) ** 2 <= r * r) occ[gi(x, y, z)] = 1;
  return { res: RES, occupied: occ };
}

type Voxel = { $omni3d: string; octree: { resolution: number[]; occupiedVoxels: number; maxDepth: number } };

async function main(): Promise<void> {
  console.log("Omni3D — real voxel draft (shape-from-silhouette carving)\n");

  // 1. A box is perfectly reconstructed by its 3 axis silhouettes (visual hull == box).
  const aBox = box(8, 24);
  const boxSils = (["x", "y", "z"] as const).map((ax) => projectSilhouette(aBox, ax));
  const boxHull = carveVisualHull(RES, boxSils);
  assert.ok(gridEquals(boxHull, aBox), "box reconstructed exactly from 3 axis silhouettes");
  console.log(`  ✓ exact box: ${countOccupied(boxHull)} voxels == original ${countOccupied(aBox)}`);

  // 2. A sphere's visual hull contains it but over-estimates (tri-cylinder > sphere).
  const aSphere = sphere(16, 12);
  const sphSils = (["x", "y", "z"] as const).map((ax) => projectSilhouette(aSphere, ax));
  const sphHull = carveVisualHull(RES, sphSils);
  assert.ok(gridContains(sphHull, aSphere), "hull contains the true sphere (no false negatives)");
  assert.ok(countOccupied(sphHull) > countOccupied(aSphere), "hull over-estimates the sphere");
  console.log(`  ✓ sphere hull ⊇ sphere: hull ${countOccupied(sphHull)} > sphere ${countOccupied(aSphere)}`);

  // 3. Carving is monotonic in the number of views.
  const c1 = countOccupied(carveVisualHull(RES, [sphSils[2]!]));
  const c2 = countOccupied(carveVisualHull(RES, [sphSils[2]!, sphSils[0]!]));
  const c3 = countOccupied(sphHull);
  assert.ok(c1 >= c2 && c2 >= c3 && c1 > c3, `more views carve more (${c1} ≥ ${c2} ≥ ${c3})`);
  console.log(`  ✓ monotonic in views: ${c1} ≥ ${c2} ≥ ${c3}`);

  // 4. Payload reports the real carved count.
  const req = CreatePipelineRequest.parse({
    video: { uri: "asset://uploads/clip.mp4", container: "mp4", durationSec: 5, fps: 30, resolution: [1920, 1080] },
    targets: { engine: "ue5", polyBudget: "hero", rigStandard: "ue5_sk_mannequin" },
  });
  const job = buildJobEnvelope(req);

  const payload = realVoxelDraft(job, sphSils, RES) as Voxel;
  assert.equal(payload.$omni3d, "loopA.voxelDraft/v1", "emits the voxel-draft payload");
  assert.deepEqual(payload.octree.resolution, [32, 32, 32], "resolution reported");
  assert.equal(payload.octree.occupiedVoxels, c3, "payload occupiedVoxels == carved hull count");
  assert.equal(payload.octree.maxDepth, 5, "octree depth = log2(res)");
  console.log(`  ✓ payload: ${payload.octree.occupiedVoxels} voxels @ ${payload.octree.resolution.join("×")}, depth ${payload.octree.maxDepth}`);

  // 5. DI seam: drive the runner to A2 with the real carver injected.
  let cur = job;
  let emitted: Voxel = { $omni3d: "" } as Voxel;
  for (let i = 0; i < 2; i++) {
    const r = await advanceJob(cur, {}, { A2: (j) => realVoxelDraft(j, sphSils, RES) });
    assert.equal(r.kind, "advanced", `advance ${i} ok`);
    if (r.kind === "advanced") {
      cur = r.job;
      emitted = r.emitted as unknown as Voxel;
    }
  }
  assert.equal(emitted.$omni3d, "loopA.voxelDraft/v1", "runner reached A2");
  assert.equal(emitted.octree.occupiedVoxels, c3, "runner used the real carver");
  console.log("  ✓ runner accepts the injected real voxel draft at A2 (DI seam)");

  console.log("\nVOXEL SMOKE PASS");
}

main().catch((err: unknown) => {
  console.error("VOXEL SMOKE FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
