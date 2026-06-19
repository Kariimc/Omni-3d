import type { PipelineJob, StagePayload } from "../schemas";
import {
  type AdvanceOpts,
  genAnimation,
  genEitl,
  genFrameSampler,
  genRetopology,
  genRigging,
  genVoxelDraft,
} from "./generators";

interface Step {
  key: string;
  tag: string;
  stage: string;
  loop: "A_structural" | "B_rigging" | "C_eitl";
  gen: (job: PipelineJob, opts: AdvanceOpts) => StagePayload;
}

/** Canonical execution plan A1 -> A2 -> A3 -> B1 -> B2 -> C. */
const STAGE_PLAN: Step[] = [
  { key: "A1", tag: "loopA.frameSampler.out/v1", stage: "frame_sampler", loop: "A_structural", gen: genFrameSampler },
  { key: "A2", tag: "loopA.voxelDraft/v1", stage: "voxel_draft", loop: "A_structural", gen: genVoxelDraft },
  { key: "A3", tag: "loopA.retopology.io/v1", stage: "retopology", loop: "A_structural", gen: genRetopology },
  { key: "B1", tag: "loopB.rigging.skinWeights/v1", stage: "rigging", loop: "B_rigging", gen: genRigging },
  { key: "B2", tag: "loopB.animation.retarget/v1", stage: "animation_retarget", loop: "B_rigging", gen: genAnimation },
  { key: "C", tag: "loopC.eitl.validation/v1", stage: "eitl", loop: "C_eitl", gen: genEitl },
];

const LOOP_TOTALS: Record<Step["loop"], number> = {
  A_structural: STAGE_PLAN.filter((s) => s.loop === "A_structural").length,
  B_rigging: STAGE_PLAN.filter((s) => s.loop === "B_rigging").length,
  C_eitl: STAGE_PLAN.filter((s) => s.loop === "C_eitl").length,
};

const r6 = (n: number): number => Math.round(n * 1e6) / 1e6;

export type AdvanceResult =
  | { kind: "advanced"; done: boolean; job: PipelineJob; emitted: StagePayload }
  | { kind: "complete" };

/** Advance a job by exactly one stage: generate the payload, update loop state,
 *  and (for Loop C) record the EITL gate outcome + micro-repair count. */
export function advanceJob(job: PipelineJob, opts: AdvanceOpts = {}): AdvanceResult {
  const cursor = job.runner?.cursor ?? -1;
  const next = cursor + 1;
  const step = STAGE_PLAN[next];
  if (!step) return { kind: "complete" };

  const updated = structuredClone(job);
  const emitted = step.gen(updated, opts);

  let eitlPassed = true;
  let repairs = 0;
  if (emitted.$omni3d === "loopC.eitl.validation/v1") {
    eitlPassed = emitted.costFunction.passed;
    repairs = emitted.microRepair.inpaintPasses;
  }

  const total = LOOP_TOTALS[step.loop];
  const doneInLoop = STAGE_PLAN.slice(0, next + 1).filter((s) => s.loop === step.loop).length;
  const loopComplete = doneInLoop === total;
  updated.loops[step.loop] = {
    stage: step.loop === "C_eitl" ? (eitlPassed ? "live_sync" : "eitl") : step.stage,
    progress: r6(doneInLoop / total),
    status: loopComplete ? (step.loop === "C_eitl" && !eitlPassed ? "failed" : "passed") : "running",
  };

  updated.runner = {
    cursor: next,
    emitted: [...(job.runner?.emitted ?? []), step.tag],
    repairs: (job.runner?.repairs ?? 0) + repairs,
  };
  updated.status = step.loop === "C_eitl" ? (eitlPassed ? "passed" : "failed") : "running";

  return { kind: "advanced", done: next === STAGE_PLAN.length - 1, job: updated, emitted };
}

export { STAGE_PLAN };
