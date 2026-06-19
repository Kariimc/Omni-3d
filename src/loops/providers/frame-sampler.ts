import type { PipelineJob, StagePayload } from "../../schemas";
import { FrameSampler } from "../../schemas";
import { decodeToGray, varianceOfLaplacian } from "./sharpness";

export interface FrameInput {
  idx: number;
  tSec: number;
  image: string | Buffer;
}

export interface RealFrameSamplerOptions {
  /** Keep frames whose normalized sharpness >= this (0..1). Default 0.4. */
  relativeThreshold?: number;
  fovDeg?: number;
}

const r6 = (n: number): number => Math.round(n * 1e6) / 1e6;

// SfM camera poses need COLMAP; until that's wired we synthesize an orbit pose.
const orbitCamera = (i: number, fovDeg: number) => {
  const a = (i % 8) * (Math.PI / 4);
  return {
    position: [r6(Math.sin(a) * 3.4), 1.2, r6(Math.cos(a) * 3.4)],
    quat: [0, r6(Math.sin(a / 2)), 0, r6(Math.cos(a / 2))],
    fovDeg,
  };
};

/** Real Loop A1: decode each frame, score sharpness (variance of Laplacian), and
 *  reject blurry frames below the relative threshold. Emits the canonical
 *  FrameSampler payload. (SfM camera trajectories remain synthetic — needs COLMAP.) */
export async function realFrameSampler(
  job: PipelineJob,
  frames: FrameInput[],
  opts: RealFrameSamplerOptions = {},
): Promise<StagePayload> {
  const relativeThreshold = opts.relativeThreshold ?? 0.4;
  const fovDeg = opts.fovDeg ?? 49.1;

  const scored: { idx: number; tSec: number; vol: number }[] = [];
  for (const f of frames) {
    const { gray, width, height } = await decodeToGray(f.image);
    scored.push({ idx: f.idx, tSec: f.tSec, vol: varianceOfLaplacian(gray, width, height) });
  }
  const maxVol = Math.max(1e-9, ...scored.map((s) => s.vol));

  const selectedFrames: unknown[] = [];
  const rejectedFrames: unknown[] = [];
  for (const s of scored) {
    const sharpness = r6(s.vol / maxVol);
    if (sharpness >= relativeThreshold) {
      selectedFrames.push({
        idx: s.idx,
        tSec: s.tSec,
        sharpness,
        blurRejected: false,
        camera: orbitCamera(s.idx, fovDeg),
      });
    } else {
      rejectedFrames.push({
        idx: s.idx,
        tSec: s.tSec,
        sharpness,
        blurRejected: true,
        reason: "low_sharpness",
      });
    }
  }

  return FrameSampler.parse({
    $omni3d: "loopA.frameSampler.out/v1",
    jobId: job.jobId,
    loop: "A_structural",
    source: { uri: job.inputs.video.uri, fps: job.inputs.video.fps, frames: frames.length },
    sfm: {
      solver: "sharpness_only",
      intrinsics: { model: "PINHOLE", fx: 1462.3, fy: 1462.3, cx: 960.0, cy: 540.0 },
      reprojectionErrorPx: 0,
      registeredFrames: selectedFrames.length,
    },
    sharpnessThreshold: relativeThreshold,
    selectedFrames,
    rejectedFrames,
    nextStage: "loopA.voxelDraft",
  });
}
