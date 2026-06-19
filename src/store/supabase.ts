import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PipelineJob, StagePayload } from "../schemas";
import type { JobStore } from "./types";

const TABLE = "jobs";
const STAGE_TABLE = "job_stages";

/** Supabase-backed store. Jobs and emitted stage payloads persist as jsonb.
 *  Requires the service-role key (server-side only). See supabase/migrations. */
export class SupabaseJobStore implements JobStore {
  readonly kind = "supabase";
  private db: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, { auth: { persistSession: false } });
  }

  async put(job: PipelineJob): Promise<void> {
    const { error } = await this.db.from(TABLE).upsert({
      id: job.jobId,
      created_at: job.createdAt,
      owner: job.owner,
      status: job.status,
      payload: job,
    });
    if (error) throw new Error(`supabase put failed: ${error.message}`);
  }

  async get(id: string): Promise<PipelineJob | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .select("payload")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`supabase get failed: ${error.message}`);
    return data ? PipelineJob.parse(data.payload) : null;
  }

  async list(limit = 50): Promise<PipelineJob[]> {
    const { data, error } = await this.db
      .from(TABLE)
      .select("payload")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`supabase list failed: ${error.message}`);
    return (data ?? []).map((row) => PipelineJob.parse(row.payload));
  }

  async putStage(jobId: string, stage: StagePayload): Promise<void> {
    const { error } = await this.db.from(STAGE_TABLE).insert({
      job_id: jobId,
      stage: stage.$omni3d,
      payload: stage,
    });
    if (error) throw new Error(`supabase putStage failed: ${error.message}`);
  }

  async getStages(jobId: string): Promise<StagePayload[]> {
    const { data, error } = await this.db
      .from(STAGE_TABLE)
      .select("payload")
      .eq("job_id", jobId)
      .order("id", { ascending: true });
    if (error) throw new Error(`supabase getStages failed: ${error.message}`);
    return (data ?? []).map((row) => StagePayload.parse(row.payload));
  }
}
