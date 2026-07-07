import { MeshoptSimplifier } from "meshoptimizer";
import type { PipelineJob, StagePayload } from "../../schemas";
import { Retopology } from "../../schemas";

export interface Mesh {
  positions: Float32Array;
  indices: Uint32Array;
}

export const QUAD_TARGET: Record<PipelineJob["targets"]["polyBudget"], number> = {
  mobile_xr: 5000,
  hero: 32000,
  nanite: 120000,
};

/** Procedural UV sphere — a real indexed triangle mesh to decimate. */
export function uvSphere(segments: number, rings: number): Mesh {
  const v: number[] = [];
  const idx: number[] = [];
  const row = segments + 1;
  for (let y = 0; y <= rings; y++) {
    const phi = (y / rings) * Math.PI;
    for (let x = 0; x <= segments; x++) {
      const th = (x / segments) * 2 * Math.PI;
      v.push(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
    }
  }
  for (let y = 0; y < rings; y++) {
    for (let x = 0; x < segments; x++) {
      const a = y * row + x;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  return { positions: new Float32Array(v), indices: new Uint32Array(idx) };
}

export interface SimplifyResult {
  indices: Uint32Array;
  error: number;
  inputTris: number;
  outputTris: number;
}

/** Real triangle decimation via meshoptimizer (WASM). */
export async function simplifyMesh(mesh: Mesh, targetTris: number, targetError = 1.0): Promise<SimplifyResult> {
  await MeshoptSimplifier.ready;
  const inputTris = mesh.indices.length / 3;
  const targetIndexCount = Math.max(3, Math.floor(targetTris) * 3);
  const [indices, error] = MeshoptSimplifier.simplify(mesh.indices, mesh.positions, 3, targetIndexCount, targetError);
  return { indices, error, inputTris, outputTris: indices.length / 3 };
}

/** Real Loop A3: decimate the high-poly mesh to the job's poly budget. meshoptimizer
 *  emits triangles, so the real numbers live in input.triangles / polyBudget; the
 *  quad-dominant cross-field, UV seams, and PBR remain a separate pass (synthetic here). */
export async function realRetopology(
  job: PipelineJob,
  mesh: Mesh,
  opts: { targetError?: number } = {},
): Promise<StagePayload> {
  const preset = job.targets.polyBudget;
  const targetQuads = QUAD_TARGET[preset];
  const { inputTris, outputTris } = await simplifyMesh(mesh, targetQuads * 2, opts.targetError ?? 1.0);
  const achievedQuads = Math.ceil(outputTris / 2);
  const base = `asset://${job.jobId}/pbr`;

  return Retopology.parse({
    $omni3d: "loopA.retopology.io/v1",
    jobId: job.jobId,
    loop: "A_structural",
    input: { highFiMesh: `asset://${job.jobId}/mesh_highfi.glb`, triangles: inputTris, extraction: "flexicubes" },
    polyBudget: { preset, targetQuads, achievedQuads, quadDominancePct: 0 },
    curvatureField: { type: "anisotropic_cross_field", alignment: "principal_curvature", singularities: 0, smoothnessLambda: 0.35 },
    uvSeams: {
      userPainted: job.features.uvSeamPainter,
      immutableSeams: [],
      islands: 1,
      stretchPct: 2.1,
      packingEfficiencyPct: 88.0,
      secondaryUV: true,
    },
    pbr: {
      inverseRender: "spherical_harmonics_l2",
      delit: job.features.pbrDelight,
      resolution: 4096,
      emissiveTerms: job.features.emissiveMapping ? ["rune gems"] : [],
      maps: {
        albedo: `${base}/albedo.png`,
        normal: `${base}/normal.png`,
        roughness: `${base}/roughness.png`,
        metallic: `${base}/metallic.png`,
        emissive: `${base}/emissive_mask.png`,
      },
    },
    watertight: { manifold: true, holes: 0, nonManifoldEdges: 0, zeroThicknessSheets: 0 },
    nextStage: "loopB.rigging",
  });
}
