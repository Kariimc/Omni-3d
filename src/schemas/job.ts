import { z } from "zod";
import {
  AssetUri,
  Engine,
  JobId,
  LoopStatus,
  PolyBudgetPreset,
  Resolution2D,
  RigStandard,
  UnitScale,
  VideoContainer,
} from "./common";

export const VideoInput = z
  .object({
    uri: AssetUri,
    container: VideoContainer,
    durationSec: z.number().positive(),
    fps: z.number().positive(),
    resolution: Resolution2D,
  })
  .strict();

export const MotionVideoInput = z
  .object({
    uri: AssetUri,
    container: VideoContainer,
    durationSec: z.number().positive(),
    fps: z.number().positive(),
  })
  .strict();

export const Targets = z
  .object({
    engine: Engine,
    unitScale: UnitScale,
    polyBudget: PolyBudgetPreset,
    humanoid: z.boolean(),
    rigStandard: RigStandard,
  })
  .strict();

export const Features = z
  .object({
    voxelDraftTweaker: z.boolean(),
    asymmetricalFusion: z.boolean(),
    polyBudgetRetopo: z.boolean(),
    uvSeamPainter: z.boolean(),
    pbrDelight: z.boolean(),
    watertightScanner: z.boolean(),
    kitbash: z.boolean(),
    emissiveMapping: z.boolean(),
    styleAnchors: z.boolean(),
    liveSync: z.boolean(),
    autoRigMocap: z.boolean(),
  })
  .strict();

export const LoopState = z
  .object({
    stage: z.string(),
    progress: z.number().min(0).max(1),
    status: LoopStatus,
  })
  .strict();

export const Loops = z
  .object({
    A_structural: LoopState,
    B_rigging: LoopState,
    C_eitl: LoopState,
  })
  .strict();

export const Artifacts = z
  .object({
    voxelDraft: AssetUri,
    highFiMesh: AssetUri,
    retopoMesh: AssetUri,
    textures: AssetUri,
    riggedMesh: AssetUri,
    animation: AssetUri,
    engineBundle: AssetUri,
  })
  .strict();

/** Top-level job envelope binding inputs, targets, feature flags, and per-loop state. */
export const PipelineJob = z
  .object({
    $omni3d: z.literal("pipeline.job/v1"),
    jobId: JobId,
    createdAt: z.string().datetime(),
    owner: z.string(),
    status: LoopStatus,
    inputs: z
      .object({
        text: z.string(),
        images: z.array(AssetUri),
        video: VideoInput,
        motionVideo: MotionVideoInput.optional(),
      })
      .strict(),
    targets: Targets,
    features: Features,
    loops: Loops,
    artifacts: Artifacts,
  })
  .strict();

export type PipelineJob = z.infer<typeof PipelineJob>;
