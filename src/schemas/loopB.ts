import { z } from "zod";
import { AssetUri, JobId, Quat, Resolution3D, RigStandard, Vec3 } from "./common";

/** Loop B — Auto-Rig & Mocap Retarget. Stages: rigging+skin-weights -> animation retarget. */

const Bone = z
  .object({
    name: z.string(),
    parent: z.string().nullable(),
    head: Vec3,
    tail: Vec3,
  })
  .strict();

export const RiggingSkinWeights = z
  .object({
    $omni3d: z.literal("loopB.rigging.skinWeights/v1"),
    jobId: JobId,
    loop: z.literal("B_rigging"),
    input: z.object({ retopoMesh: AssetUri, vertices: z.number().int() }).strict(),
    rigStandard: RigStandard,
    jointPrediction: z
      .object({
        model: z.string(),
        voxelGrid: Resolution3D,
        confidence: z.number().min(0).max(1),
      })
      .strict(),
    skeleton: z
      .object({
        root: z.string(),
        boneCount: z.number().int(),
        namingConvention: z.string(),
        bones: z.array(Bone),
      })
      .strict(),
    skinWeighting: z
      .object({
        method: z.string(),
        maxInfluencesPerVertex: z.number().int(),
        normalized: z.boolean(),
        sample: z.array(
          z
            .object({
              vertex: z.number().int(),
              influences: z.array(
                z.object({ bone: z.string(), weight: z.number() }).strict(),
              ),
            })
            .strict(),
        ),
      })
      .strict(),
    nextStage: z.literal("loopB.animationRetarget"),
  })
  .strict();

const AnimTrack = z
  .object({
    bone: z.string(),
    keys: z.array(
      z
        .object({ t: z.number(), pos: Vec3.optional(), rot: Quat })
        .strict(),
    ),
  })
  .strict();

export const AnimationRetarget = z
  .object({
    $omni3d: z.literal("loopB.animation.retarget/v1"),
    jobId: JobId,
    loop: z.literal("B_rigging"),
    motionSource: z
      .object({ uri: AssetUri, fps: z.number(), frames: z.number().int() })
      .strict(),
    capture: z
      .object({
        model: z.string(),
        jointCount: z.number().int(),
        worldGrounded: z.boolean(),
        trajectorySmoothness: z.number(),
      })
      .strict(),
    retarget: z
      .object({
        from: z.string(),
        to: RigStandard,
        ikSolver: z.string(),
        footLock: z
          .object({
            enabled: z.boolean(),
            groundPlaneY: z.number(),
            slideResidualCm: z.number(),
            jitterSuppression: z.number(),
          })
          .strict(),
      })
      .strict(),
    bakedClip: z
      .object({
        name: z.string(),
        format: z.string(),
        fps: z.number(),
        durationSec: z.number(),
        keyframeCount: z.number().int(),
        uri: AssetUri,
        tracks: z.array(AnimTrack),
      })
      .strict(),
    nextStage: z.literal("loopC.eitl"),
  })
  .strict();

export type RiggingSkinWeights = z.infer<typeof RiggingSkinWeights>;
export type AnimationRetarget = z.infer<typeof AnimationRetarget>;
