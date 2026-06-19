import { LiveSyncClient } from "./live/client";
import { ConsoleEngineBridge } from "./live/engine";

// Usage: tsx src/live-client.ts <jobId> [--url=ws://host:port]
const args = process.argv.slice(2);
const jobId = args.find((a) => !a.startsWith("--"));
const base = args.find((a) => a.startsWith("--url="))?.slice("--url=".length) ?? "ws://127.0.0.1:8787";

if (!jobId) {
  console.error("usage: tsx src/live-client.ts <jobId> [--url=ws://host:port]");
  process.exit(2);
}

const bridge = new ConsoleEngineBridge();
const bar = (p: number): string => {
  const n = Math.round(p * 20);
  return "█".repeat(n) + "░".repeat(20 - n);
};

const client = new LiveSyncClient(base, jobId, {
  onConnected: (e) => console.log(`● connected — watching ${e.jobId}`),
  onStage: (e) => {
    console.log(`▷ ${e.stage}`);
    console.log(`   A ${bar(e.loops.A_structural.progress)} ${e.loops.A_structural.status}`);
    console.log(`   B ${bar(e.loops.B_rigging.progress)} ${e.loops.B_rigging.status}`);
    console.log(`   C ${bar(e.loops.C_eitl.progress)} ${e.loops.C_eitl.status}`);
  },
  onEitl: (e) =>
    console.log(
      `   EITL E=${e.score} ${e.passed ? "≤" : ">"} T=${e.threshold} → ${e.passed ? "PASS" : "FAIL"} (repairs=${e.repairs})`,
    ),
  onAssetPush: (e) => {
    console.log(`⇪ asset.push → ${e.engine}`);
    bridge.apply(e);
  },
  onComplete: (e) => {
    console.log(`✓ pipeline ${e.status}`);
    client.close();
    process.exit(e.status === "passed" ? 0 : 1);
  },
  onError: (m) => console.error(`✗ ${m}`),
  onClose: () => console.log("○ disconnected"),
});

client.connect().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
