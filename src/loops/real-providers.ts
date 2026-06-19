import { Jimp } from "jimp";
import type { PipelineJob, StagePayload } from "../schemas";
import { type FrameInput, realFrameSampler } from "./providers/frame-sampler";
import { realEitl } from "./providers/mesh-check";
import { type MotionClip, realRetarget } from "./providers/retarget";
import { type Mesh, realRetopology } from "./providers/retopology";
import { type BoneSeg, realSkinWeights } from "./providers/skin-weights";
import { projectSilhouette, realVoxelDraft, type Silhouette, type VoxelGrid } from "./providers/voxel-carve";
import { advanceJob, type AdvanceResult, type StageGen } from "./runner";

/** The real artifacts every real provider consumes — one coherent set per job. In a
 *  production build these come from the uploaded video (frames, SfM, mocap); here they
 *  are generated procedurally so the whole pipeline can run on real algorithms offline. */
export interface StageContext {
  frames: FrameInput[];
  silhouettes: Silhouette[];
  voxelRes: [number, number, number];
  mesh: Mesh; // watertight high-poly mesh shared by retopo / skinning / EITL
  bones: BoneSeg[];
  motion: MotionClip;
}

type V3 = [number, number, number];
const normalize = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

/** Watertight, manifold, high-poly mesh: a subdivided icosahedron projected to the unit
 *  sphere (shared vertices via a midpoint cache — no seams). */
export function icosphere(subdivisions: number): Mesh {
  const t = (1 + Math.sqrt(5)) / 2;
  const verts: V3[] = (
    [
      [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
      [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
      [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
    ] as V3[]
  ).map(normalize);
  let faces: V3[] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  for (let s = 0; s < subdivisions; s++) {
    const mid = new Map<string, number>();
    const midpoint = (a: number, b: number): number => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      const cached = mid.get(key);
      if (cached !== undefined) return cached;
      const m = normalize([
        (verts[a]![0] + verts[b]![0]) / 2,
        (verts[a]![1] + verts[b]![1]) / 2,
        (verts[a]![2] + verts[b]![2]) / 2,
      ]);
      const index = verts.push(m) - 1;
      mid.set(key, index);
      return index;
    };
    const next: V3[] = [];
    for (const [a, b, c] of faces) {
      const ab = midpoint(a, b);
      const bc = midpoint(b, c);
      const ca = midpoint(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = next;
  }
  return { positions: new Float32Array(verts.flat()), indices: new Uint32Array(faces.flat()) };
}

function voxelSphere(res: [number, number, number], center: number, radius: number): VoxelGrid {
  const [nx, ny, nz] = res;
  const occupied = new Uint8Array(nx * ny * nz);
  for (let z = 0; z < nz; z++)
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++)
        if ((x - center) ** 2 + (y - center) ** 2 + (z - center) ** 2 <= radius * radius)
          occupied[(z * ny + y) * nx + x] = 1;
  return { res, occupied };
}

function sampleWalk(): MotionClip {
  const fps = 30;
  const frames = 48;
  const noise = (i: number): number => {
    const f = Math.sin(i * 12.9898) * 43758.5453;
    return (f - Math.floor(f)) * 2 - 1;
  };
  const swingY = (phase: number): number => 0.04 + 0.1 * Math.sin(Math.PI * phase);
  const root: V3[] = [];
  const left: V3[] = [];
  const right: V3[] = [];
  for (let i = 0; i < frames; i++) {
    root.push([0.01 * noise(i), 0.95, (0.4 * i) / (frames - 1) + 0.01 * noise(i + 99)]);
    const half = frames / 2;
    if (i < half) {
      left.push([-0.1, 0, 0.1 + 0.12 * (i / (half - 1))]);
      right.push([0.1, swingY(i / half), 0.1 + 0.3 * (i / (half - 1))]);
    } else {
      left.push([-0.1, swingY((i - half) / half), 0.1 + 0.3 * ((i - half) / (half - 1))]);
      right.push([0.1, 0, 0.25 + 0.12 * ((i - half) / (half - 1))]);
    }
  }
  return { fps, root, feet: [{ bone: "foot_l", pos: left }, { bone: "foot_r", pos: right }] };
}

async function checkerPng(blur: boolean): Promise<Buffer> {
  const W = 48;
  const H = 48;
  const img = new Jimp({ width: W, height: H, color: 0x000000ff });
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const on = (((x / 4) | 0) + ((y / 4) | 0)) % 2 === 1;
      const v = on ? 255 : 0;
      img.setPixelColor(((v << 24) | (v << 16) | (v << 8) | 0xff) >>> 0, x, y);
    }
  if (blur) img.blur(4);
  return img.getBuffer("image/png");
}

/** Build one coherent set of real inputs for a job. Async because frame decoding is. */
export async function buildStageContext(): Promise<StageContext> {
  const voxelRes: [number, number, number] = [24, 24, 24];
  const grid = voxelSphere(voxelRes, 12, 9);
  const [sharp, blur] = await Promise.all([checkerPng(false), checkerPng(true)]);
  return {
    frames: [
      { idx: 0, tSec: 0.0, image: sharp },
      { idx: 1, tSec: 0.4, image: blur },
      { idx: 2, tSec: 0.8, image: sharp },
      { idx: 3, tSec: 1.2, image: blur },
    ],
    silhouettes: (["x", "y", "z"] as const).map((axis) => projectSilhouette(grid, axis)),
    voxelRes,
    mesh: icosphere(5), // 20,480 triangles, watertight
    bones: [
      { name: "spine_lower", parent: null, head: [0, -1, 0], tail: [0, 0, 0] },
      { name: "spine_upper", parent: "spine_lower", head: [0, 0, 0], tail: [0, 1, 0] },
    ],
    motion: sampleWalk(),
  };
}

/** The real provider for each stage, bound to one context — the production analogue of
 *  the synthetic generators in the runner's STAGE_PLAN. */
export function buildRealProviders(ctx: StageContext): Partial<Record<string, StageGen>> {
  return {
    A1: (job) => realFrameSampler(job, ctx.frames),
    A2: (job) => realVoxelDraft(job, ctx.silhouettes, ctx.voxelRes),
    A3: (job) => realRetopology(job, ctx.mesh),
    B1: (job) => realSkinWeights(job, ctx.mesh, ctx.bones, { iterations: 60 }),
    B2: (job) => realRetarget(job, ctx.motion),
    C: (job) => realEitl(job, ctx.mesh),
  };
}

/** Drive a job to completion through the runner. When job.features.realPipeline is set,
 *  every stage runs its real provider; otherwise the synthetic generators run. Same
 *  runner, same loop chain, same EITL gate — the flag only swaps the implementations. */
export async function runRealPipeline(
  job: PipelineJob,
  ctx: StageContext,
): Promise<{ job: PipelineJob; payloads: StagePayload[] }> {
  const overrides = job.features.realPipeline ? buildRealProviders(ctx) : {};
  let current = job;
  const payloads: StagePayload[] = [];
  for (;;) {
    const result: AdvanceResult = await advanceJob(current, {}, overrides);
    if (result.kind === "complete") break;
    current = result.job;
    payloads.push(result.emitted);
  }
  return { job: current, payloads };
}
