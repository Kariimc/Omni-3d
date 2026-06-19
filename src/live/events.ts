import { z } from "zod";
import type { PipelineJob, StagePayload } from "../schemas";
import { EitlEngine, LoopStatus } from "../schemas/common";
import { Loops } from "../schemas/job";

/** Optional monotonic sequence number, assigned by the event store on persist.
 *  Lets clients resume a stream from where they left off (?from=<seq>). */
const withSeq = { seq: z.number().int().optional() };

/** Wire protocol for the Live-Sync WebSocket bridge (Feature #10). One discriminated
 *  union so a UE5/Unity client can validate every frame against a single contract. */
export const LiveEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("connected"), jobId: z.string(), ts: z.string(), ...withSeq }).strict(),
  z
    .object({
      type: z.literal("stage.completed"),
      jobId: z.string(),
      stage: z.string(),
      done: z.boolean(),
      status: LoopStatus,
      loops: Loops,
      ts: z.string(),
      ...withSeq,
    })
    .strict(),
  z
    .object({
      type: z.literal("eitl.result"),
      jobId: z.string(),
      passed: z.boolean(),
      score: z.number(),
      threshold: z.number(),
      repairs: z.number().int(),
      rerunPhases: z.array(z.string()),
      ts: z.string(),
      ...withSeq,
    })
    .strict(),
  z
    .object({
      type: z.literal("asset.push"),
      jobId: z.string(),
      engine: EitlEngine,
      bundle: z.string(),
      endpoint: z.string(),
      ts: z.string(),
      ...withSeq,
    })
    .strict(),
  z
    .object({
      type: z.literal("pipeline.complete"),
      jobId: z.string(),
      status: LoopStatus,
      ts: z.string(),
      ...withSeq,
    })
    .strict(),
  z.object({ type: z.literal("error"), message: z.string(), ts: z.string(), ...withSeq }).strict(),
]);
export type LiveEvent = z.infer<typeof LiveEvent>;

const now = (): string => new Date().toISOString();

export const connectedEvent = (jobId: string): LiveEvent =>
  LiveEvent.parse({ type: "connected", jobId, ts: now() });

export const errorEvent = (message: string): LiveEvent =>
  LiveEvent.parse({ type: "error", message, ts: now() });

/** Map a single runner advance into the ordered events a client should receive.
 *  (seq is assigned later, when the event store persists each one.) */
export function eventsForAdvance(
  job: PipelineJob,
  emitted: StagePayload,
  done: boolean,
): LiveEvent[] {
  const ts = now();
  const out: unknown[] = [
    {
      type: "stage.completed",
      jobId: job.jobId,
      stage: emitted.$omni3d,
      done,
      status: job.status,
      loops: job.loops,
      ts,
    },
  ];

  if (emitted.$omni3d === "loopC.eitl.validation/v1") {
    out.push({
      type: "eitl.result",
      jobId: job.jobId,
      passed: emitted.costFunction.passed,
      score: emitted.costFunction.score,
      threshold: emitted.costFunction.threshold,
      repairs: emitted.microRepair.inpaintPasses,
      rerunPhases: emitted.microRepair.rerunPhases,
      ts,
    });
    if (emitted.costFunction.passed) {
      out.push({
        type: "asset.push",
        jobId: job.jobId,
        engine: emitted.liveSync.engine,
        bundle: job.artifacts.engineBundle,
        endpoint: emitted.liveSync.endpoint,
        ts,
      });
    }
  }

  if (done) {
    out.push({ type: "pipeline.complete", jobId: job.jobId, status: job.status, ts });
  }

  return out.map((e) => LiveEvent.parse(e));
}
