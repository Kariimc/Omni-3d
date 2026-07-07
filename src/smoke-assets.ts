/** WO-01 smoke — real file I/O: upload → real pipeline → download a real .glb, plus the
 *  negative cases (path traversal, oversize, bad type). Runs against a temp data dir. */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.OMNI3D_MAX_UPLOAD_MB = "0.01"; // ~10 KB cap so the oversize test is cheap
const DATA_DIR = mkdtempSync(join(tmpdir(), "omni-assets-smoke-"));
process.env.OMNI3D_DATA_DIR = DATA_DIR;

const { buildApp } = await import("./app");
const { LocalAssetStore } = await import("./assets/store");
const { MemoryJobStore } = await import("./store/memory");
const { buildStageContext, runRealPipeline } = await import("./loops/real-providers");
const { buildJobEnvelope, CreatePipelineRequest } = await import("./schemas");

let fails = 0;
const check = (ok: boolean, label: string): void => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}`);
  if (!ok) fails++;
};

// A tiny valid PNG (1x1, pre-encoded) — enough for upload-path testing.
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function upload(base: string, bytes: Buffer, type: string): Promise<Response> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(bytes)], { type }), "probe.bin");
  return fetch(`${base}/assets`, { method: "POST", body: form });
}

async function main(): Promise<void> {
  console.log("Omni3D — asset I/O smoke (WO-01)\n");
  const assets = new LocalAssetStore(DATA_DIR);
  const app = await buildApp(new MemoryJobStore(), undefined, assets);
  const base = await app.listen({ port: 0, host: "127.0.0.1" });

  // 1. Happy-path upload + download round-trip
  const up = await upload(base, PNG_1PX, "image/png");
  const body = (await up.json()) as { uri: string };
  check(up.status === 201 && body.uri.startsWith("asset://uploads/"), `upload png → 201 + ${body.uri ?? "?"}`);
  const down = await fetch(`${base}/assets/${body.uri.replace("asset://", "")}`);
  const roundtrip = Buffer.from(await down.arrayBuffer());
  check(down.status === 200 && roundtrip.equals(PNG_1PX), "download returns identical bytes");

  // 2. Negative: unsupported content type → 400
  const bad = await upload(base, Buffer.from("{}"), "application/json");
  check(bad.status === 400, "unsupported type → 400");

  // 3. Negative: oversize → 413
  const big = await upload(base, Buffer.alloc(64 * 1024, 1), "image/png");
  check(big.status === 413, "upload over size cap → 413");

  // 4. Negative: path traversal → 404, never file contents
  for (const evil of ["..%2f..%2fpackage.json", "../../package.json", "uploads/../../package.json"]) {
    const r = await fetch(`${base}/assets/${evil}`);
    const leaked = r.status === 200;
    check(!leaked && (r.status === 404 || r.status === 400), `traversal "${evil}" blocked (${r.status})`);
  }

  // 5. Real pipeline writes a real, downloadable .glb
  const req = CreatePipelineRequest.parse({
    video: { uri: body.uri, container: "mp4", durationSec: 2, fps: 30, resolution: [640, 360] },
    targets: { engine: "ue5", polyBudget: "mobile_xr", rigStandard: "ue5_sk_mannequin" },
    features: { realPipeline: true },
  });
  const { job: final } = await runRealPipeline(buildJobEnvelope(req), await buildStageContext(), assets);
  check(final.status === "passed", "real pipeline → status passed");
  check(final.artifacts.retopoMesh.endsWith(".glb"), `manifest points at stored glb: ${final.artifacts.retopoMesh}`);
  const glbRes = await fetch(`${base}/assets/${final.artifacts.retopoMesh.replace("asset://", "")}`);
  const glb = Buffer.from(await glbRes.arrayBuffer());
  check(glbRes.status === 200 && glb.subarray(0, 4).toString("ascii") === "glTF" && glb.length > 1000,
    `downloaded glb: ${glb.length} bytes, magic "glTF", content-type ${glbRes.headers.get("content-type")}`);

  await app.close();
  rmSync(DATA_DIR, { recursive: true, force: true });

  if (fails > 0) {
    console.error(`\nASSETS SMOKE FAIL (${fails})`);
    process.exit(1);
  }
  console.log("\nASSETS SMOKE PASS");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
