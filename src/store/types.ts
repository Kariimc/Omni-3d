import type { PipelineJob } from "../schemas/job";

/** Persistence contract for pipeline jobs. Implemented by MemoryJobStore and SupabaseJobStore. */
export interface JobStore {
  readonly kind: string;
  put(job: PipelineJob): Promise<void>;
  get(id: string): Promise<PipelineJob | null>;
  list(limit?: number): Promise<PipelineJob[]>;
}
