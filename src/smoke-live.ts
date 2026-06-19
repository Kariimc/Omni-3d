import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { buildApp } from "./app";
import { LiveSyncClient } from "./live/client";
import { RecordingEngineBridge } from "./live/engine";
import { MemoryJobStore } from "./store/memory";

const JSON_HEADERS = { "content-type": "application/json" };
const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const createBody = {
  text: "weathered bronze knight statue",
  video: {
    uri: "asset://uploads/orbit_pan.mp4",
    container: "mp4",
    durationSec: 12.4,
    fps: 30,
    resolution: [1920, 1080],
  },
  targets: { engine: "ue5", polyBudget: "hero", rigStandard: "ue5_sk_mannequin" },
};

interface AnyEvent {
  type: string;
  seq?: number;
  [k: string]: unknown;
}

async function main(): Promise<void> {
  const app = await buildApp(new MemoryJobStore());
  await app.listen({ port: 0, host: "127.0.0.1" });
  const { port } = app.server.address() as AddressInfo;
  const base = `ws://127.0.0.1:${port}`;

  const created = await app.inject({
    method: "POST",
    url: "/pipeline",
    headers: JSON_HEADERS,
    payload: JSON.stringify(createBody),
  });
  assert.equal(created.statusCode, 201, "POST /pipeline -> 201");
  const id = created.json().jobId as string;

  // --- live client + engine bridge, streamed in real time ---
  const bridge = new RecordingEngineBridge();
  const seen = {
    connected: false,
    stages: 0,
    eitl: undefined as { passed: boolean; repairs: number } | undefined,
    push: false,
    complete: undefined as { status: string } | undefined,
    error: undefined as string | undefined,
  };
  const live = new LiveSyncClient(base, id, {
    onConnected: () => (seen.connected = true),
    onStage: () => (seen.stages += 1),
    onEitl: (e) => (seen.eitl = { passed: e.passed, repairs: e.repairs }),
    onAssetPush: (e) => {
      seen.push = true;
      bridge.apply(e);
    },
    onComplete: (e) => (seen.complete = { status: e.status }),
    onError: (m) => (seen.error = m),
  });
  await live.connect();
  assert.ok(seen.connected, "client received connected ack");

  for (let i = 0; i < 5; i++) {
    await app.inject({ method: "POST", url: `/jobs/${id}/advance` });
  }
  await app.inject({ method: "POST", url: `/jobs/${id}/advance?defect=vertex_tear` });
  for (let i = 0; i < 50 && !seen.complete; i++) await delay(20);

  assert.equal(seen.error, undefined, "no malformed events");
  assert.equal(seen.stages, 6, "client saw 6 stage events");
  assert.ok(seen.eitl?.passed === true && seen.eitl.repairs >= 1, "EITL repaired and passed");
  assert.ok(seen.push, "client received asset.push");
  assert.equal(seen.complete?.status, "passed", "pipeline complete = passed");
  assert.ok(bridge.actions.some((a) => a.kind === "place_mesh"), "engine placed the mesh");
  live.close();

  // --- durable log persisted (REST view) ---
  const log = (await app.inject({ method: "GET", url: `/jobs/${id}/events` })).json() as AnyEvent[];
  assert.equal(log.length, 9, "9 events persisted (6 stage + eitl + push + complete)");
  assert.ok(
    log.every((e, i) => i === 0 || (e.seq ?? 0) > (log[i - 1]?.seq ?? 0)),
    "event seq is strictly increasing",
  );

  // --- replay: a fresh client after completion receives the full history ---
  const replayed: AnyEvent[] = [];
  const collect = (e: AnyEvent) => replayed.push(e);
  const c2 = new LiveSyncClient(base, id, {
    onStage: collect,
    onEitl: collect,
    onAssetPush: collect,
    onComplete: collect,
  });
  await c2.connect();
  await delay(60);
  assert.equal(replayed.length, 9, "replay delivered the full history");
  c2.close();

  // --- resume: connect with from=<3rd seq>, receive only later events ---
  const midSeq = log[2]?.seq ?? 0;
  const resumed: AnyEvent[] = [];
  const collect3 = (e: AnyEvent) => resumed.push(e);
  const c3 = new LiveSyncClient(
    base,
    id,
    { onStage: collect3, onEitl: collect3, onAssetPush: collect3, onComplete: collect3 },
    { from: midSeq },
  );
  await c3.connect();
  await delay(60);
  assert.equal(resumed.length, 6, "resume from 3rd seq skips the first 3 events");
  assert.ok(resumed.every((e) => (e.seq ?? 0) > midSeq), "resumed events are all after from");
  c3.close();

  // --- drop mid-stream, then resume from lastSeq (no gap, no dup) — what the dashboard does ---
  const j3 = (
    await app.inject({ method: "POST", url: "/pipeline", headers: JSON_HEADERS, payload: JSON.stringify(createBody) })
  ).json().jobId as string;
  const pushA: AnyEvent[] = [];
  const cA = new LiveSyncClient(base, j3, {
    onStage: (e) => pushA.push(e),
    onEitl: (e) => pushA.push(e),
  });
  await cA.connect();
  await app.inject({ method: "POST", url: `/jobs/${j3}/advance` }); // A1
  await app.inject({ method: "POST", url: `/jobs/${j3}/advance` }); // A2
  await delay(40);
  const seqAtDrop = cA.lastSeq;
  cA.close(); // simulate a dropped connection
  await app.inject({ method: "POST", url: `/jobs/${j3}/advance` }); // A3 emitted while offline
  await delay(40);

  const afterDrop: AnyEvent[] = [];
  const cB = new LiveSyncClient(
    base,
    j3,
    { onStage: (e) => afterDrop.push(e), onEitl: (e) => afterDrop.push(e) },
    { from: seqAtDrop },
  );
  await cB.connect();
  await delay(40);
  assert.ok(seqAtDrop > 0, "saw events before the drop");
  assert.ok(afterDrop.length >= 1, "resume delivered events missed while offline");
  assert.ok(afterDrop.every((e) => (e.seq ?? 0) > seqAtDrop), "resume sent only events after the drop point");
  assert.ok(
    afterDrop.some((e) => e.type === "stage.completed" && e.stage === "loopA.retopology.io/v1"),
    "the A3 event emitted during the drop was replayed on resume",
  );
  cB.close();

  await app.close();
  console.log(
    `LIVE SMOKE PASS — stream(6 stages, repairs=${seen.eitl?.repairs}), engine[${bridge.actions
      .map((a) => a.kind)
      .join(", ")}], persisted=${log.length}, replay=${replayed.length}, resume=${resumed.length}, drop-resume=${afterDrop.length}`,
  );
}

main().catch((err: unknown) => {
  console.error("LIVE SMOKE FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
