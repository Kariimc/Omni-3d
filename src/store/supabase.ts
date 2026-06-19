import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { LiveEvent } from "../live/events";
import { PipelineJob, StagePayload } from "../schemas";
import type { JobStore } from "./types";

const TABLE = "jobs";
const STAGE_TABLE = "job_stages";
const EVENT_TABLE = "job_events";

/** Supabase-backed store. Jobs, stage payloads, and live events persist as jsonb.
 *  The event row id doubles as the monotonic seq. See supabase/migrations. */
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

  async appendEvent(jobId: string, event: LiveEvent): Promise<LiveEvent> {
    const { data, error } = await this.db
      .from(EVENT_TABLE)
      .insert({ job_id: jobId, type: event.type, payload: event })
      .select("id")
      .single();
    if (error) throw new Error(`supabase appendEvent failed: ${error.message}`);
    return { ...event, seq: data.id as number } as LiveEvent;
  }

  async getEvents(jobId: string, fromSeq = 0): Promise<LiveEvent[]> {
    const { data, error } = await this.db
      .from(EVENT_TABLE)
      .select("id,payload")
      .eq("job_id", jobId)
      .gt("id", fromSeq)
      .order("id", { ascending: true });
    if (error) throw new Error(`supabase getEvents failed: ${error.message}`);
    return (data ?? []).map((row) => LiveEvent.parse({ ...row.payload, seq: row.id }));
  }
}
