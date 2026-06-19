import type { PipelineJob, StagePayload } from "../schemas";

/** Persistence contract for pipeline jobs and their emitted stage payloads. */
export interface JobStore {
  readonly kind: string;
  put(job: PipelineJob): Promise<void>;
  get(id: string): Promise<PipelineJob | null>;
  list(limit?: number): Promise<PipelineJob[]>;
  putStage(jobId: string, stage: StagePayload): Promise<void>;
  getStages(jobId: string): Promise<StagePayload[]>;
}
