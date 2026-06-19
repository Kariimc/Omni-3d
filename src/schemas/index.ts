import { z } from "zod";
import { PipelineJob } from "./job";
import { FrameSampler, Retopology, VoxelDraft } from "./loopA";
import { AnimationRetarget, RiggingSkinWeights } from "./loopB";
import { EitlValidation } from "./loopC";

export * from "./common";
export { PipelineJob, RunnerState } from "./job";
export { FrameSampler, VoxelDraft, Retopology } from "./loopA";
export { RiggingSkinWeights, AnimationRetarget } from "./loopB";
export { EitlValidation } from "./loopC";
export { CreatePipelineRequest, buildJobEnvelope, newJobId } from "./request";

/** Discriminated union over the `$omni3d` tag — routes any payload to its schema. */
export const OmniPayload = z.discriminatedUnion("$omni3d", [
  PipelineJob,
  FrameSampler,
  VoxelDraft,
  Retopology,
  RiggingSkinWeights,
  AnimationRetarget,
  EitlValidation,
]);
export type OmniPayload = z.infer<typeof OmniPayload>;

/** Stage payloads only (the job envelope excluded) — what a runner emits per step. */
export const StagePayload = z.discriminatedUnion("$omni3d", [
  FrameSampler,
  VoxelDraft,
  Retopology,
  RiggingSkinWeights,
  AnimationRetarget,
  EitlValidation,
]);
export type StagePayload = z.infer<typeof StagePayload>;

/** Registry: `$omni3d` tag -> schema. Used by the validator and the JSON Schema exporter. */
export const SCHEMAS = {
  "pipeline.job/v1": PipelineJob,
  "loopA.frameSampler.out/v1": FrameSampler,
  "loopA.voxelDraft/v1": VoxelDraft,
  "loopA.retopology.io/v1": Retopology,
  "loopB.rigging.skinWeights/v1": RiggingSkinWeights,
  "loopB.animation.retarget/v1": AnimationRetarget,
  "loopC.eitl.validation/v1": EitlValidation,
} as const;

/** Canonical closed-loop ordering (envelope excluded). Each stage must point to the next. */
export const STAGE_CHAIN = [
  { id: "loopA.frameSampler.out/v1", nextStage: "loopA.voxelDraft" },
  { id: "loopA.voxelDraft/v1", nextStage: "loopA.retopology" },
  { id: "loopA.retopology.io/v1", nextStage: "loopB.rigging" },
  { id: "loopB.rigging.skinWeights/v1", nextStage: "loopB.animationRetarget" },
  { id: "loopB.animation.retarget/v1", nextStage: "loopC.eitl" },
  { id: "loopC.eitl.validation/v1", nextStage: null },
] as const;
