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

async function main(): Promise<void> {
  const app = await buildApp(new MemoryJobStore());
  await app.listen({ port: 0, host: "127.0.0.1" });
  const { port } = app.server.address() as AddressInfo;

  const created = await app.inject({
    method: "POST",
    url: "/pipeline",
    headers: JSON_HEADERS,
    payload: JSON.stringify(createBody),
  });
  assert.equal(created.statusCode, 201, "POST /pipeline -> 201");
  const id = created.json().jobId as string;

  // Drive the engine-side client + bridge exactly as a real UE5/Unity plugin would.
  const bridge = new RecordingEngineBridge();
  const seen = {
    connected: false,
    stages: 0,
    eitl: undefined as { passed: boolean; repairs: number } | undefined,
    push: false,
    complete: undefined as { status: string } | undefined,
    error: undefined as string | undefined,
  };

  const client = new LiveSyncClient(`ws://127.0.0.1:${port}`, id, {
    onConnected: () => {
      seen.connected = true;
    },
    onStage: () => {
      seen.stages++;
    },
    onEitl: (e) => {
      seen.eitl = { passed: e.passed, repairs: e.repairs };
    },
    onAssetPush: (e) => {
      seen.push = true;
      bridge.apply(e);
    },
    onComplete: (e) => {
      seen.complete = { status: e.status };
    },
    onError: (m) => {
      seen.error = m;
    },
  });

  await client.connect();
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
  assert.ok(bridge.actions.length >= 5, "engine applied the full action set");

  client.close();
  await app.close();
  console.log(
    `LIVE SMOKE PASS — client: ${seen.stages} stages, EITL repairs=${seen.eitl?.repairs}, engine applied [${bridge.actions.map((a) => a.kind).join(", ")}]`,
  );
}

main().catch((err: unknown) => {
  console.error("LIVE SMOKE FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
