import assert from "node:assert/strict";
import { analyzeMesh, realEitl } from "./loops/providers/mesh-check";
import type { Mesh } from "./loops/providers/retopology";
import { advanceJob } from "./loops/runner";
import { buildJobEnvelope, CreatePipelineRequest } from "./schemas";

// A genuinely closed, manifold mesh: 8 shared vertices, 12 triangles, every edge
// shared by exactly two faces.
function unitCube(): Mesh {
  const positions = new Float32Array([
    0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0,
    0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1,
  ]);
  const indices = new Uint32Array([
    0, 1, 2, 0, 2, 3, // bottom
    4, 5, 6, 4, 6, 7, // top
    0, 1, 5, 0, 5, 4, // front
    3, 2, 6, 3, 6, 7, // back
    0, 3, 7, 0, 7, 4, // left
    1, 2, 6, 1, 6, 5, // right
  ]);
  return { positions, indices };
}

function keepTriangles(mesh: Mesh, keep: (t: number) => boolean): Mesh {
  const out: number[] = [];
  const tris = mesh.indices.length / 3;
  for (let t = 0; t < tris; t++) {
    if (keep(t)) out.push(mesh.indices[t * 3]!, mesh.indices[t * 3 + 1]!, mesh.indices[t * 3 + 2]!);
  }
  return { positions: mesh.positions, indices: new Uint32Array(out) };
}

function withExtraFace(mesh: Mesh): Mesh {
  const idx = Array.from(mesh.indices);
  idx.push(mesh.indices[0]!, mesh.indices[1]!, mesh.indices[2]!); // duplicate face -> its edges shared by 3
  return { positions: mesh.positions, indices: new Uint32Array(idx) };
}

type Eitl = {
  $omni3d: string;
  costFunction: { terms: { L_manifold: number }; passed: boolean };
  checks: { watertight: boolean };
  microRepair: { triggered: boolean; failureSites: { term: string; before: number }[] };
};

async function main(): Promise<void> {
  console.log("Omni3D — real Mesh integrity / EITL gate\n");

  const cube = unitCube();
  const closed = analyzeMesh(cube);
  assert.ok(closed.watertight && closed.manifold, "closed cube is watertight + manifold");
  assert.equal(closed.boundaryEdges, 0, "no boundary edges");
  assert.equal(closed.nonManifoldEdges, 0, "no non-manifold edges");
  console.log(`  ✓ closed cube: ${closed.triangles} tris, ${closed.edges} edges, 0 boundary/non-manifold`);

  const holed = keepTriangles(cube, (t) => t % 4 === 0);
  const ht = analyzeMesh(holed);
  assert.ok(!ht.watertight && ht.boundaryEdges > 0, "holed mesh has boundary edges");
  console.log(`  ✓ holed mesh: ${ht.boundaryEdges} boundary edges → not watertight`);

  const nm = analyzeMesh(withExtraFace(cube));
  assert.ok(nm.nonManifoldEdges > 0, "extra face creates non-manifold edges");
  console.log(`  ✓ non-manifold mesh: ${nm.nonManifoldEdges} edges shared by >2 faces`);

  const req = CreatePipelineRequest.parse({
    video: { uri: "asset://uploads/clip.mp4", container: "mp4", durationSec: 5, fps: 30, resolution: [1920, 1080] },
    targets: { engine: "ue5", polyBudget: "hero", rigStandard: "ue5_sk_mannequin" },
  });
  const job = buildJobEnvelope(req);

  const clean = realEitl(job, cube) as Eitl;
  assert.equal(clean.costFunction.terms.L_manifold, 0, "watertight mesh → zero manifold defect");
  assert.equal(clean.costFunction.passed, true, "clean mesh passes EITL");
  assert.equal(clean.microRepair.triggered, false, "no repair for a clean mesh");
  assert.equal(clean.checks.watertight, true, "reported watertight");
  console.log("  ✓ realEitl(clean): E measured from geometry = 0, pass, no repair");

  const bad = realEitl(job, holed) as Eitl;
  assert.ok(bad.microRepair.triggered, "real hole triggered the micro-repair back-edge");
  assert.equal(bad.microRepair.failureSites[0]?.term, "L_manifold", "repair targeted the manifold defect");
  assert.ok((bad.microRepair.failureSites[0]?.before ?? 0) > 0.1, "measured a large real defect");
  assert.equal(bad.checks.watertight, false, "still reports the mesh as not watertight");
  console.log(
    `  ✓ realEitl(holed): real defect=${bad.microRepair.failureSites[0]?.before} → repair → passed=${bad.costFunction.passed}`,
  );

  // DI seam: drive the runner to C with the real integrity check injected
  let cur = job;
  let emitted: Eitl = { $omni3d: "" } as Eitl;
  for (let i = 0; i < 6; i++) {
    const r = await advanceJob(cur, {}, { C: (j) => realEitl(j, cube) });
    assert.equal(r.kind, "advanced", `advance ${i} ok`);
    if (r.kind === "advanced") {
      cur = r.job;
      emitted = r.emitted as unknown as Eitl;
    }
  }
  assert.equal(emitted.$omni3d, "loopC.eitl.validation/v1", "runner reached C");
  assert.equal(emitted.checks.watertight, true, "runner used the real integrity provider");
  console.log("  ✓ runner accepts the injected real EITL at C (DI seam)");

  console.log("\nMESH SMOKE PASS");
}

main().catch((err: unknown) => {
  console.error("MESH SMOKE FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
