import { z } from "zod";
import {
  AssetUri,
  Axis,
  BrushTool,
  JobId,
  PolyBudgetPreset,
  Quat,
  Resolution3D,
  Vec3,
} from "./common";

/** Loop A — Video-to-Asset Structural. Stages: frame sampler -> voxel draft -> retopology. */

const CameraPose = z
  .object({ position: Vec3, quat: Quat, fovDeg: z.number() })
  .strict();

export const FrameSampler = z
  .object({
    $omni3d: z.literal("loopA.frameSampler.out/v1"),
    jobId: JobId,
    loop: z.literal("A_structural"),
    source: z
      .object({ uri: AssetUri, fps: z.number(), frames: z.number().int() })
      .strict(),
    sfm: z
      .object({
        solver: z.string(),
        intrinsics: z
          .object({
            model: z.string(),
            fx: z.number(),
            fy: z.number(),
            cx: z.number(),
            cy: z.number(),
          })
          .strict(),
        reprojectionErrorPx: z.number(),
        registeredFrames: z.number().int(),
      })
      .strict(),
    sharpnessThreshold: z.number(),
    selectedFrames: z.array(
      z
        .object({
          idx: z.number().int(),
          tSec: z.number(),
          sharpness: z.number(),
          blurRejected: z.boolean(),
          camera: CameraPose,
        })
        .strict(),
    ),
    rejectedFrames: z.array(
      z
        .object({
          idx: z.number().int(),
          tSec: z.number(),
          sharpness: z.number(),
          blurRejected: z.boolean(),
          reason: z.string(),
        })
        .strict(),
    ),
    nextStage: z.literal("loopA.voxelDraft"),
  })
  .strict();

export const VoxelDraft = z
  .object({
    $omni3d: z.literal("loopA.voxelDraft/v1"),
    jobId: JobId,
    loop: z.literal("A_structural"),
    generationProgress: z.number().min(0).max(1),
    octree: z
      .object({
        format: z.string(),
        maxDepth: z.number().int(),
        resolution: Resolution3D,
        occupiedVoxels: z.number().int(),
        bboxMin: Vec3,
        bboxMax: Vec3,
        uri: AssetUri,
      })
      .strict(),
    userEdits: z
      .object({
        brushStrokes: z.array(
          z
            .object({
              tool: BrushTool,
              radius: z.number(),
              strength: z.number(),
              path: z.array(Vec3),
            })
            .strict(),
        ),
        asymmetry: z
          .object({
            enabled: z.boolean(),
            mirrorOverride: z.boolean(),
            regions: z.array(
              z
                .object({
                  name: z.string(),
                  axis: Axis,
                  lockMirror: z.boolean(),
                  note: z.string(),
                })
                .strict(),
            ),
          })
          .strict(),
      })
      .strict(),
    latentWeightDeltas: AssetUri,
    nextStage: z.literal("loopA.retopology"),
  })
  .strict();

export const Retopology = z
  .object({
    $omni3d: z.literal("loopA.retopology.io/v1"),
    jobId: JobId,
    loop: z.literal("A_structural"),
    input: z
      .object({
        highFiMesh: AssetUri,
        triangles: z.number().int(),
        extraction: z.string(),
      })
      .strict(),
    polyBudget: z
      .object({
        preset: PolyBudgetPreset,
        targetQuads: z.number().int(),
        achievedQuads: z.number().int(),
        quadDominancePct: z.number(),
      })
      .strict(),
    curvatureField: z
      .object({
        type: z.string(),
        alignment: z.string(),
        singularities: z.number().int(),
        smoothnessLambda: z.number(),
      })
      .strict(),
    uvSeams: z
      .object({
        userPainted: z.boolean(),
        immutableSeams: z.array(
          z.object({ name: z.string(), polyline: z.array(Vec3) }).strict(),
        ),
        islands: z.number().int(),
        stretchPct: z.number(),
        packingEfficiencyPct: z.number(),
        secondaryUV: z.boolean(),
      })
      .strict(),
    pbr: z
      .object({
        inverseRender: z.string(),
        delit: z.boolean(),
        resolution: z.number().int(),
        emissiveTerms: z.array(z.string()),
        maps: z
          .object({
            albedo: AssetUri,
            normal: AssetUri,
            roughness: AssetUri,
            metallic: AssetUri,
            emissive: AssetUri,
          })
          .strict(),
      })
      .strict(),
    watertight: z
      .object({
        manifold: z.boolean(),
        holes: z.number().int(),
        nonManifoldEdges: z.number().int(),
        zeroThicknessSheets: z.number().int(),
      })
      .strict(),
    nextStage: z.literal("loopB.rigging"),
  })
  .strict();

export type FrameSampler = z.infer<typeof FrameSampler>;
export type VoxelDraft = z.infer<typeof VoxelDraft>;
export type Retopology = z.infer<typeof Retopology>;
