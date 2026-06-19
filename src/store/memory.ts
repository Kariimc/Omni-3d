import type { PipelineJob } from "../schemas/job";
import type { JobStore } from "./types";

/** Zero-dependency in-memory store. Default when Supabase env is not configured. */
export class MemoryJobStore implements JobStore {
  readonly kind = "memory";
  private jobs = new Map<string, PipelineJob>();

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
}
