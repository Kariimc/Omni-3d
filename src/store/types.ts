import type { LiveEvent } from "../live/events";
import type { PipelineJob, StagePayload } from "../schemas";

/** Persistence contract for jobs, emitted stage payloads, and the live event log. */
export interface JobStore {
  readonly kind: string;
  put(job: PipelineJob): Promise<void>;
  get(id: string): Promise<PipelineJob | null>;
  list(limit?: number): Promise<PipelineJob[]>;
  putStage(jobId: string, stage: StagePayload): Promise<void>;
  getStages(jobId: string): Promise<StagePayload[]>;
  /** Append a live event, assigning a monotonic seq; returns the event with seq set. */
  appendEvent(jobId: string, event: LiveEvent): Promise<LiveEvent>;
  /** Events for a job with seq > fromSeq, in order (for replay/resume). */
  getEvents(jobId: string, fromSeq?: number): Promise<LiveEvent[]>;
}
