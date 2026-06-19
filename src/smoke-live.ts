import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { buildApp } from "./app";
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
  [k: string]: unknown;
}

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

  const events: AnyEvent[] = [];
  const ws = new WebSocket(`ws://127.0.0.1:${port}/live?jobId=${id}`);
  ws.addEventListener("message", (m: MessageEvent) => events.push(JSON.parse(String(m.data))));

  // Wait until the server-side subscription is live (the `connected` ack arrived).
  await new Promise<void>((resolve, reject) => {
    ws.addEventListener("error", () => reject(new Error("ws connection error")));
    const iv = setInterval(() => {
      if (events.some((e) => e.type === "connected")) {
        clearInterval(iv);
        resolve();
      }
    }, 10);
  });
  assert.equal(events[0]?.type, "connected", "first event = connected");

  // Drive the full pipeline; inject a defect at Loop C to exercise the repair path.
  for (let i = 0; i < 5; i++) {
    await app.inject({ method: "POST", url: `/jobs/${id}/advance` });
  }
  await app.inject({ method: "POST", url: `/jobs/${id}/advance?defect=vertex_tear` });

  for (let i = 0; i < 50 && !events.some((e) => e.type === "pipeline.complete"); i++) {
    await delay(20);
  }

  const stages = events.filter((e) => e.type === "stage.completed");
  const eitl = events.find((e) => e.type === "eitl.result");
  const push = events.find((e) => e.type === "asset.push");
  const complete = events.find((e) => e.type === "pipeline.complete");

  assert.equal(stages.length, 6, "6 stage.completed events streamed");
  assert.ok(eitl && eitl.passed === true && (eitl.repairs as number) >= 1, "eitl.result passed after repair");
  assert.ok(push && push.engine === "ue5", "asset.push streamed");
  assert.ok(complete && complete.status === "passed", "pipeline.complete = passed");

  ws.close();
  await app.close();
  console.log(
    `LIVE SMOKE PASS — ${events.length} events (${stages.length} stages, eitl repairs=${eitl?.repairs}, asset.push→${push?.engine})`,
  );
}

main().catch((err: unknown) => {
  console.error("LIVE SMOKE FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
