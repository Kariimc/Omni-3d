import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PipelineJob } from "../schemas/job";
import type { JobStore } from "./types";

const TABLE = "jobs";

/** Supabase-backed store. Persists the full envelope in a jsonb `payload` column.
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
}
