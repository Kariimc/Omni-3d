import type { PipelineJob, StagePayload } from "../schemas";
import type { JobStore } from "./types";

/** Zero-dependency in-memory store. Default when Supabase env is not configured. */
export class MemoryJobStore implements JobStore {
  readonly kind = "memory";
  private jobs = new Map<string, PipelineJob>();
  private stages = new Map<string, StagePayload[]>();

  async put(job: PipelineJob): Promise<void> {
    this.jobs.set(job.jobId, job);
  }

  async get(id: string): Promise<PipelineJob | null> {
    return this.jobs.get(id) ?? null;
  }

  async list(limit = 50): Promise<PipelineJob[]> {
    return [...this.jobs.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async putStage(jobId: string, stage: StagePayload): Promise<void> {
    const arr = this.stages.get(jobId) ?? [];
    arr.push(stage);
    this.stages.set(jobId, arr);
  }

  async getStages(jobId: string): Promise<StagePayload[]> {
    return [...(this.stages.get(jobId) ?? [])];
  }
}
