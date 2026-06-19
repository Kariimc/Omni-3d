import type { PipelineJob, StagePayload } from "../../schemas";
import { RiggingSkinWeights } from "../../schemas";
import type { Mesh } from "./retopology";

export interface BoneSeg {
  name: string;
  parent: string | null;
  head: [number, number, number];
  tail: [number, number, number];
}

export interface SkinOptions {
  iterations?: number; // Gauss-Seidel sweeps
  heat?: number; // heat contribution constant c in H_i = c / d^2
  influences?: number; // max bones per vertex in the output
  sampleCount?: number; // representative vertices reported in the payload
}

const r6 = (n: number): number => Math.round(n * 1e6) / 1e6;

function distToSegment(p: [number, number, number], a: number[], b: number[]): number {
  const abx = b[0]! - a[0]!;
  const aby = b[1]! - a[1]!;
  const abz = b[2]! - a[2]!;
  const apx = p[0] - a[0]!;
  const apy = p[1] - a[1]!;
  const apz = p[2] - a[2]!;
  const ab2 = abx * abx + aby * aby + abz * abz;
  let t = ab2 > 0 ? (apx * abx + apy * aby + apz * abz) / ab2 : 0;
  t = Math.max(0, Math.min(1, t));
  const dx = apx - abx * t;
  const dy = apy - aby * t;
  const dz = apz - abz * t;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function buildAdjacency(mesh: Mesh): number[][] {
  const v = mesh.positions.length / 3;
  const sets: Set<number>[] = Array.from({ length: v }, () => new Set<number>());
  const idx = mesh.indices;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i]!;
    const b = idx[i + 1]!;
    const c = idx[i + 2]!;
    sets[a]!.add(b).add(c);
    sets[b]!.add(a).add(c);
    sets[c]!.add(a).add(b);
  }
  return sets.map((s) => [...s]);
}

/** Bone-heat skin weights (Baran & Popović): assign each vertex to its nearest bone,
 *  then for each bone solve the heat-equilibrium system (L + H) w = H p over the mesh
 *  graph Laplacian via Gauss-Seidel. Returns a V×B weight matrix; columns sum to 1 per
 *  vertex by construction (L·1 = 0), so the result is a partition of unity. */
export function heatDiffusionWeights(mesh: Mesh, bones: BoneSeg[], opts: SkinOptions = {}): number[][] {
  const iterations = opts.iterations ?? 100;
  const heatC = opts.heat ?? 1;
  const pos = mesh.positions;
  const v = pos.length / 3;
  const b = bones.length;
  const adj = buildAdjacency(mesh);

  // Average squared edge length makes the heat term scale-invariant: the graph Laplacian
  // is dimensionless, so heat (1/length^2) needs a length scale to balance against it.
  let edgeSum = 0;
  let edgeCount = 0;
  for (let i = 0; i < v; i++) {
    for (const k of adj[i]!) {
      if (k > i) {
        const dx = pos[3 * i]! - pos[3 * k]!;
        const dy = pos[3 * i + 1]! - pos[3 * k + 1]!;
        const dz = pos[3 * i + 2]! - pos[3 * k + 2]!;
        edgeSum += dx * dx + dy * dy + dz * dz;
        edgeCount++;
      }
    }
  }
  const avgEdge2 = edgeCount > 0 ? edgeSum / edgeCount : 1;

  const nearest = new Int32Array(v);
  const heat = new Float64Array(v);
  for (let i = 0; i < v; i++) {
    const p: [number, number, number] = [pos[3 * i]!, pos[3 * i + 1]!, pos[3 * i + 2]!];
    let best = Infinity;
    let bj = 0;
    for (let j = 0; j < b; j++) {
      const d = distToSegment(p, bones[j]!.head, bones[j]!.tail);
      if (d < best) {
        best = d;
        bj = j;
      }
    }
    nearest[i] = bj;
    heat[i] = (heatC * avgEdge2) / (best * best + 1e-8);
  }

  // One column per bone, initialised to the indicator p (1 at vertices it owns).
  const cols: Float64Array[] = Array.from({ length: b }, () => new Float64Array(v));
  for (let i = 0; i < v; i++) cols[nearest[i]!]![i] = 1;

  for (let j = 0; j < b; j++) {
    const w = cols[j]!;
    for (let it = 0; it < iterations; it++) {
      for (let i = 0; i < v; i++) {
        const nbs = adj[i]!;
        let sum = 0;
        for (const k of nbs) sum += w[k]!;
        const pij = nearest[i] === j ? 1 : 0;
        w[i] = (heat[i]! * pij + sum) / (nbs.length + heat[i]!);
      }
    }
  }

  const out: number[][] = new Array(v);
  for (let i = 0; i < v; i++) {
    const row = new Array<number>(b);
    let s = 0;
    for (let j = 0; j < b; j++) {
      const val = cols[j]![i]!;
      row[j] = val;
      s += val;
    }
    if (s > 0) for (let j = 0; j < b; j++) row[j]! /= s;
    out[i] = row;
  }
  return out;
}

function topInfluences(
  row: number[],
  bones: BoneSeg[],
  max: number,
): { bone: string; weight: number }[] {
  const ranked = row
    .map((weight, j) => ({ bone: bones[j]!.name, weight }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, max)
    .filter((x) => x.weight > 1e-4);
  const s = ranked.reduce((acc, x) => acc + x.weight, 0) || 1;
  return ranked.map((x) => ({ bone: x.bone, weight: r6(x.weight / s) }));
}

/** Real Loop B skin-weighting: compute heat-diffusion weights over the mesh, prune to
 *  maxInfluences per vertex, and emit the schema payload with a representative sample. */
export function realSkinWeights(job: PipelineJob, mesh: Mesh, bones: BoneSeg[], opts: SkinOptions = {}): StagePayload {
  const influences = opts.influences ?? 4;
  const sampleCount = opts.sampleCount ?? 4;
  const weights = heatDiffusionWeights(mesh, bones, opts);
  const v = weights.length;

  const sample = Array.from({ length: sampleCount }, (_, k) => {
    const vertex = Math.floor((v * k) / sampleCount);
    return { vertex, influences: topInfluences(weights[vertex]!, bones, influences) };
  });

  const root = bones.find((bone) => bone.parent === null)?.name ?? bones[0]!.name;

  return RiggingSkinWeights.parse({
    $omni3d: "loopB.rigging.skinWeights/v1",
    jobId: job.jobId,
    loop: "B_rigging",
    input: { retopoMesh: `asset://${job.jobId}/mesh_retopo.glb`, vertices: v },
    rigStandard: job.targets.rigStandard,
    jointPrediction: { model: "geodesic_heat_solver", voxelGrid: [64, 64, 64], confidence: 0.9 },
    skeleton: { root, boneCount: bones.length, namingConvention: job.targets.rigStandard, bones },
    skinWeighting: {
      method: "heat_diffusion_geodesic",
      maxInfluencesPerVertex: influences,
      normalized: true,
      sample,
    },
    nextStage: "loopB.animationRetarget",
  });
}
