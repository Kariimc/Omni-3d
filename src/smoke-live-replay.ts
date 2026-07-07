/** Regression smoke (wargame 07): /live replay failures must be VISIBLE to the client.
 *  If the store throws during the replay-from-log phase, the client would otherwise get a
 *  silent gap (missing events with no signal). The wire protocol has an `error` event type
 *  for exactly this — assert the client receives it, then keeps the live stream. */
import WebSocket from "ws";
import { buildApp } from "./app";
import type { LiveEvent } from "./live/events";
import { MemoryJobStore } from "./store/memory";

const REQ = {
  text: "probe",
  video: { uri: "asset://uploads/p.mp4", container: "mp4", durationSec: 2.0, fps: 30, resolution: [640, 360] },
  targets: { engine: "ue5", unitScale: "cm", polyBudget: "hero", humanoid: true, rigStandard: "ue5_sk_mannequin" },
};

/** Store whose event-log read fails — models a flaky/unavailable persistence layer. */
class ReplayFailingStore extends MemoryJobStore {
  async getEvents(): Promise<LiveEvent[]> {
    throw new Error("simulated store outage during replay");
  }
}

async function main(): Promise<void> {
  console.log("Omni3D — live replay-failure visibility\n");
  const store = new ReplayFailingStore();
  const app = await buildApp(store);
  const addr = await app.listen({ port: 0, host: "127.0.0.1" });

  const create = await fetch(`${addr}/pipeline`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(REQ),
  });
  const { jobId } = (await create.json()) as { jobId: string };

  const received: LiveEvent[] = [];
  const ws = new WebSocket(`${addr.replace("http", "ws")}/live?jobId=${jobId}`);
  ws.on("message", (d) => received.push(JSON.parse(d.toString()) as LiveEvent)); // attach BEFORE open — first frames arrive immediately
  await new Promise((r) => ws.on("open", r));
  await new Promise<void>((res) => setTimeout(res, 600)); // connected + (expected) replay-error arrive immediately

  // The live stream must still work after the failed replay.
  await fetch(`${addr}/jobs/${jobId}/advance`, { method: "POST" });
  await new Promise((r) => setTimeout(r, 300));
  ws.close();
  await app.close();

  const connected = received.some((e) => e.type === "connected");
  const replayError = received.some((e) => e.type === "error" && /replay/i.test((e as { message?: string }).message ?? ""));
  const liveStage = received.some((e) => e.type === "stage.completed");

  const check = (ok: boolean, label: string): boolean => {
    console.log(`  ${ok ? "✓" : "✗"} ${label}`);
    return ok;
  };
  const pass =
    check(connected, "connected banner received") &&
    check(replayError, "replay failure surfaced as an `error` event (not a silent gap)") &&
    check(liveStage, "live stream still delivers events after the failed replay");

  if (!pass) {
    console.error("\nLIVE-REPLAY SMOKE FAIL");
    process.exit(1);
  }
  console.log("\nLIVE-REPLAY SMOKE PASS");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
