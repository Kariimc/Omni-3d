import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fastifyWebsocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";
import { InMemoryEventBus, type EventBus } from "./live/bus";
import { connectedEvent, errorEvent, eventsForAdvance, type LiveEvent } from "./live/events";
import { advanceJob } from "./loops/runner";
import { SCHEMAS, StagePayload } from "./schemas";
import { CreatePipelineRequest, buildJobEnvelope } from "./schemas/request";
import type { JobStore } from "./store";

const DEFECTS = ["manifold", "intersections", "vertex_tear"] as const;

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const DASHBOARD = {
  html: readFileSync(join(PUBLIC_DIR, "index.html"), "utf8"),
  css: readFileSync(join(PUBLIC_DIR, "dashboard.css"), "utf8"),
  js: readFileSync(join(PUBLIC_DIR, "dashboard.js"), "utf8"),
};

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

  // Live web dashboard (3-phase workspace) — self-contained, same-origin.
  app.get("/", async (_req, reply) => reply.type("text/html").send(DASHBOARD.html));
  app.get("/dashboard.css", async (_req, reply) => reply.type("text/css").send(DASHBOARD.css));
  app.get("/dashboard.js", async (_req, reply) =>
    reply.type("application/javascript").send(DASHBOARD.js),
  );

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

  // Drive the pipeline one stage forward; persist each event then stream it.
  app.post("/jobs/:id/advance", async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = await store.get(id);
    if (!job) return reply.code(404).send({ error: "not_found", id });

    const { defect } = req.query as { defect?: string };
    const chosen = DEFECTS.find((d) => d === defect);
    const result = await advanceJob(job, chosen ? { defect: chosen } : {});
    if (result.kind === "complete") {
      return reply.code(409).send({ error: "pipeline_complete", id });
    }
    await store.put(result.job);
    await store.putStage(id, result.emitted);
    for (const ev of eventsForAdvance(result.job, result.emitted, result.done)) {
      const persisted = await store.appendEvent(id, ev);
      bus.publish(id, persisted);
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

  app.get("/jobs/:id/stages", async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = await store.get(id);
    if (!job) return reply.code(404).send({ error: "not_found", id });
    return store.getStages(id);
  });

  // REST view of the durable event log (also drives WS replay).
  app.get("/jobs/:id/events", async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = await store.get(id);
    if (!job) return reply.code(404).send({ error: "not_found", id });
    const { from } = req.query as { from?: string };
    return store.getEvents(id, from ? Number(from) : 0);
  });

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

  // Live-Sync bridge (Feature #10): replay the durable log from ?from=<seq>, then
  // stream live. Subscribe before reading the log so no event is missed in between.
  app.get("/live", { websocket: true }, async (conn, req) => {
    const raw = conn as unknown as { socket?: Sock } & Sock;
    const socket: Sock = raw.socket ?? raw;
    const { jobId, from } = req.query as { jobId?: string; from?: string };
    if (!jobId) {
      socket.send(JSON.stringify(errorEvent("query param 'jobId' is required")));
      socket.close();
      return;
    }

    socket.send(JSON.stringify(connectedEvent(jobId)));

    const fromSeq = from ? Number(from) : 0;
    let lastSent = Number.isFinite(fromSeq) ? fromSeq : 0;
    let replaying = true;
    const buffered: LiveEvent[] = [];
    const send = (ev: LiveEvent): void => {
      const seq = ev.seq ?? 0;
      if (seq > lastSent) {
        socket.send(JSON.stringify(ev));
        lastSent = seq;
      }
    };

    const unsubscribe = bus.subscribe(jobId, (ev) => {
      if (replaying) buffered.push(ev);
      else send(ev);
    });
    socket.on("close", unsubscribe);

    try {
      for (const ev of await store.getEvents(jobId, lastSent)) send(ev);
    } catch {
      // Replay is best-effort, but the failure must be VISIBLE: without this signal a
      // resuming client gets a silent gap in its event log. Continue with the live stream.
      socket.send(JSON.stringify(errorEvent("event replay failed; stream may have a gap — refetch /jobs/:id/events")));
    }
    replaying = false;
    for (const ev of buffered) send(ev);
  });

  return app;
}
