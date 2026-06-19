import fastifyWebsocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";
import { InMemoryEventBus, type EventBus } from "./live/bus";
import { connectedEvent, errorEvent, eventsForAdvance } from "./live/events";
import { advanceJob } from "./loops/runner";
import { SCHEMAS, StagePayload } from "./schemas";
import { CreatePipelineRequest, buildJobEnvelope } from "./schemas/request";
import type { JobStore } from "./store";

const DEFECTS = ["manifold", "intersections", "vertex_tear"] as const;

/** Subset of the ws.WebSocket surface we use — tolerant of @fastify/websocket
 *  version differences (raw WebSocket vs SocketStream). */
interface Sock {
  send(data: string): void;
  close(): void;
  on(event: "close", cb: () => void): void;
}

/** Build the Omni3D API. Pure factory (no listen) so it is testable via app.inject(). */
export async function buildApp(
  store: JobStore,
  bus: EventBus = new InMemoryEventBus(),
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(fastifyWebsocket);

  app.get("/health", async () => ({
    ok: true,
    store: store.kind,
    schemas: Object.keys(SCHEMAS).length,
  }));

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

  // Drive the closed-loop pipeline forward one stage (A1 -> A2 -> ... -> C),
  // and stream the resulting events to any connected Live-Sync clients.
  app.post("/jobs/:id/advance", async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = await store.get(id);
    if (!job) return reply.code(404).send({ error: "not_found", id });

    const { defect } = req.query as { defect?: string };
    const chosen = DEFECTS.find((d) => d === defect);
    const result = advanceJob(job, chosen ? { defect: chosen } : {});
    if (result.kind === "complete") {
      return reply.code(409).send({ error: "pipeline_complete", id });
    }
    await store.put(result.job);
    await store.putStage(id, result.emitted);
    for (const ev of eventsForAdvance(result.job, result.emitted, result.done)) {
      bus.publish(id, ev);
    }
    return reply.code(200).send({
      done: result.done,
      stage: result.emitted.$omni3d,
      status: result.job.status,
      loops: result.job.loops,
      runner: result.job.runner,
      emitted: result.emitted,
    });
  });

  // List the stage payloads the runner has emitted, in order.
  app.get("/jobs/:id/stages", async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = await store.get(id);
    if (!job) return reply.code(404).send({ error: "not_found", id });
    return store.getStages(id);
  });

  // Validate-and-ack an externally produced stage payload via the discriminated union.
  app.post("/jobs/:id/stages", async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = await store.get(id);
    if (!job) return reply.code(404).send({ error: "not_found", id });

    const parsed = StagePayload.safeParse(req.body);
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

  // Live-Sync bridge (Feature #10): stream a job's runner events to UE5/Unity.
  // Connect with ws://host/live?jobId=<id>.
  app.get("/live", { websocket: true }, (conn, req) => {
    const raw = conn as unknown as { socket?: Sock } & Sock;
    const socket: Sock = raw.socket ?? raw;
    const { jobId } = req.query as { jobId?: string };
    if (!jobId) {
      socket.send(JSON.stringify(errorEvent("query param 'jobId' is required")));
      socket.close();
      return;
    }
    socket.send(JSON.stringify(connectedEvent(jobId)));
    const unsubscribe = bus.subscribe(jobId, (ev) => socket.send(JSON.stringify(ev)));
    socket.on("close", unsubscribe);
  });

  return app;
}
