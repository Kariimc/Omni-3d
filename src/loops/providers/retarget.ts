import type { PipelineJob, StagePayload } from "../../schemas";
import { AnimationRetarget } from "../../schemas";

type V3 = [number, number, number];

export interface MotionClip {
  fps: number;
  root: V3[]; // per-frame root position
  feet: { bone: string; pos: V3[] }[]; // per-frame foot positions
}

export interface RetargetOptions {
  groundPlaneY?: number; // default: lowest foot sample
  contactEps?: number; // foot is planted when y <= groundPlaneY + eps (default 0.03)
  lockStrength?: number; // soft-lock blend toward stance centroid, 0..1 (default 0.9)
  smoothWindow?: number; // root smoothing window in frames (default 5)
}

export interface RetargetAnalysis {
  groundPlaneY: number;
  stancePhases: number;
  originalSlideCm: number;
  residualSlideCm: number;
  trajectorySmoothness: number; // fraction of total root acceleration removed, 0..1
  jitterSuppression: number; // fraction of peak root acceleration removed, 0..1
  smoothedRoot: V3[];
  lockedFeet: { bone: string; pos: V3[] }[];
}

const r2 = (n: number): number => Math.round(n * 1e2) / 1e2;
const r4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const hyp2 = (x: number, z: number): number => Math.sqrt(x * x + z * z);

/** Soft foot-lock for one foot: detect contiguous stance phases (foot near the ground),
 *  blend each planted frame's horizontal position toward the stance centroid, and report
 *  the worst slide before and after locking. */
function lockFoot(
  pos: V3[],
  groundPlaneY: number,
  eps: number,
  strength: number,
): { locked: V3[]; phases: number; originalSlide: number; residualSlide: number } {
  const n = pos.length;
  const locked: V3[] = pos.map((p) => [...p] as V3);
  let phases = 0;
  let originalSlide = 0;
  let residualSlide = 0;
  let i = 0;
  while (i < n) {
    if (pos[i]![1] > groundPlaneY + eps) {
      i++;
      continue;
    }
    let j = i;
    while (j < n && pos[j]![1] <= groundPlaneY + eps) j++;
    phases++;
    let cx = 0;
    let cz = 0;
    for (let k = i; k < j; k++) {
      cx += pos[k]![0];
      cz += pos[k]![2];
    }
    cx /= j - i;
    cz /= j - i;
    for (let k = i; k < j; k++) {
      originalSlide = Math.max(originalSlide, hyp2(pos[k]![0] - cx, pos[k]![2] - cz));
      const lx = pos[k]![0] + strength * (cx - pos[k]![0]);
      const lz = pos[k]![2] + strength * (cz - pos[k]![2]);
      locked[k] = [lx, pos[k]![1], lz];
      residualSlide = Math.max(residualSlide, hyp2(lx - cx, lz - cz));
    }
    i = j;
  }
  return { locked, phases, originalSlide, residualSlide };
}

function smoothPath(pts: V3[], window: number): V3[] {
  const n = pts.length;
  const half = Math.floor(window / 2);
  const out: V3[] = [];
  for (let i = 0; i < n; i++) {
    let sx = 0;
    let sy = 0;
    let sz = 0;
    let c = 0;
    for (let k = Math.max(0, i - half); k <= Math.min(n - 1, i + half); k++) {
      sx += pts[k]![0];
      sy += pts[k]![1];
      sz += pts[k]![2];
      c++;
    }
    out.push([sx / c, sy / c, sz / c]);
  }
  return out;
}

/** Per-frame acceleration (second difference) magnitudes: total and peak — a jitter proxy. */
function accelStats(pts: V3[]): { sum: number; max: number } {
  let sum = 0;
  let max = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const ax = pts[i + 1]![0] - 2 * pts[i]![0] + pts[i - 1]![0];
    const ay = pts[i + 1]![1] - 2 * pts[i]![1] + pts[i - 1]![1];
    const az = pts[i + 1]![2] - 2 * pts[i]![2] + pts[i - 1]![2];
    const a = Math.sqrt(ax * ax + ay * ay + az * az);
    sum += a;
    max = Math.max(max, a);
  }
  return { sum, max };
}

export function retargetClip(clip: MotionClip, opts: RetargetOptions = {}): RetargetAnalysis {
  const eps = opts.contactEps ?? 0.03;
  const strength = opts.lockStrength ?? 0.9;
  const window = opts.smoothWindow ?? 5;
  const groundPlaneY =
    opts.groundPlaneY ?? Math.min(...clip.feet.flatMap((f) => f.pos.map((p) => p[1])), 0);

  let phases = 0;
  let originalSlide = 0;
  let residualSlide = 0;
  const lockedFeet = clip.feet.map((f) => {
    const res = lockFoot(f.pos, groundPlaneY, eps, strength);
    phases += res.phases;
    originalSlide = Math.max(originalSlide, res.originalSlide);
    residualSlide = Math.max(residualSlide, res.residualSlide);
    return { bone: f.bone, pos: res.locked };
  });

  const before = accelStats(clip.root);
  const smoothedRoot = smoothPath(clip.root, window);
  const after = accelStats(smoothedRoot);

  return {
    groundPlaneY: r4(groundPlaneY),
    stancePhases: phases,
    originalSlideCm: r2(originalSlide * 100),
    residualSlideCm: r2(residualSlide * 100),
    trajectorySmoothness: r4(before.sum > 0 ? clamp01(1 - after.sum / before.sum) : 1),
    jitterSuppression: r4(before.max > 0 ? clamp01(1 - after.max / before.max) : 1),
    smoothedRoot,
    lockedFeet,
  };
}

/** Real Loop B animation retarget: foot-lock IK + trajectory smoothing on a source clip,
 *  emitting the AnimationRetarget payload with the measured foot-slide and jitter metrics. */
export function realRetarget(job: PipelineJob, clip: MotionClip, opts: RetargetOptions = {}): StagePayload {
  const a = retargetClip(clip, opts);
  const frames = clip.root.length;
  const t = (i: number): number => Math.round((i / clip.fps) * 1e4) / 1e4;
  const key = (p: V3, i: number): { t: number; pos: V3; rot: [number, number, number, number] } => ({
    t: t(i),
    pos: [r4(p[0]), r4(p[1]), r4(p[2])],
    rot: [0, 0, 0, 1],
  });

  const tracks = [
    { bone: "root", keys: a.smoothedRoot.map((p, i) => key(p, i)) },
    ...a.lockedFeet.map((f) => ({ bone: f.bone, keys: f.pos.map((p, i) => key(p, i)) })),
  ];

  return AnimationRetarget.parse({
    $omni3d: "loopB.animation.retarget/v1",
    jobId: job.jobId,
    loop: "B_rigging",
    motionSource: { uri: `asset://${job.jobId}/motion_source.mov`, fps: clip.fps, frames },
    capture: {
      model: "monocular_hmr",
      jointCount: 2 + clip.feet.length,
      worldGrounded: true,
      trajectorySmoothness: a.trajectorySmoothness,
    },
    retarget: {
      from: "source_skeleton",
      to: job.targets.rigStandard,
      ikSolver: "two_bone_analytic",
      footLock: {
        enabled: true,
        groundPlaneY: a.groundPlaneY,
        slideResidualCm: a.residualSlideCm,
        jitterSuppression: a.jitterSuppression,
      },
    },
    bakedClip: {
      name: "retargeted_clip",
      format: "fbx_animstack",
      fps: clip.fps,
      durationSec: r2((frames - 1) / clip.fps),
      keyframeCount: frames,
      uri: `asset://${job.jobId}/anim.fbx`,
      tracks,
    },
    nextStage: "loopC.eitl",
  });
}
