import Fastify, { type FastifyInstance } from "fastify";
import { OmniPayload, SCHEMAS } from "./schemas";
import { CreatePipelineRequest, buildJobEnvelope } from "./schemas/request";
import type { JobStore } from "./store";

/** Build the Omni3D API. Pure factory (no listen) so it is testable via app.inject(). */
export function buildApp(store: JobStore): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({
    ok: true,
    store: store.kind,
    schemas: Object.keys(SCHEMAS).length,
  }));

  // List the canonical payload contracts this service validates against.
  app.get("/schemas", async () => Object.keys(SCHEMAS));

  // Create a job: validate request -> build schema-valid envelope -> persist.
  app.post("/pipeline", async (req, reply) => {
    const parsed = CreatePipelineRequest.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request", issues: parsed.error.issues });
    }
    const owner = (req.headers["x-omni-owner"] as string | undefined) ?? "user_anon";
    const job = buildJobEnvelope(parsed.data, owner);
    await store.put(job);
    return reply.code(201).send(job);
  });

  app.get("/jobs", async (req) => {
    const { limit } = req.query as { limit?: string };
    return store.list(limit ? Number(limit) : undefined);
  });

  app.get("/jobs/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = await store.get(id);
    if (!job) return reply.code(404).send({ error: "not_found", id });
    return job;
  });

  // Accept any Loop A/B/C stage payload; validate via the discriminated union.
  app.post("/jobs/:id/stages", async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = await store.get(id);
    if (!job) return reply.code(404).send({ error: "not_found", id });

    const parsed = OmniPayload.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_payload", issues: parsed.error.issues });
    }
    if (parsed.data.jobId !== id) {
      return reply
        .code(409)
        .send({ error: "job_id_mismatch", expected: id, got: parsed.data.jobId });
    }
    return reply.code(200).send({ accepted: true, stage: parsed.data.$omni3d, jobId: id });
  });

  return app;
}
