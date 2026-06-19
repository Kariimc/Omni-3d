import assert from "node:assert/strict";
import { Jimp } from "jimp";
import { type FrameInput, realFrameSampler } from "./loops/providers/frame-sampler";
import { varianceOfLaplacian } from "./loops/providers/sharpness";
import { advanceJob } from "./loops/runner";
import { buildJobEnvelope, CreatePipelineRequest } from "./schemas";

const W = 64;
const H = 64;
const BLOCK = 4;

function checkerboard(): Float64Array {
  const g = new Float64Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) g[y * W + x] = (((x / BLOCK) | 0) + ((y / BLOCK) | 0)) % 2 ? 255 : 0;
  return g;
}

function gradient(): Float64Array {
  const g = new Float64Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y * W + x] = ((x + y) / (W + H)) * 255;
  return g;
}

async function makeImage(sharp: boolean): Promise<Buffer> {
  const img = new Jimp({ width: W, height: H, color: 0x000000ff });
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const on = (((x / BLOCK) | 0) + ((y / BLOCK) | 0)) % 2 === 1;
      const v = on ? 255 : 0;
      const color = (((v << 24) | (v << 16) | (v << 8) | 0xff) >>> 0);
      img.setPixelColor(color, x, y);
    }
  }
  if (!sharp) img.blur(4);
  return img.getBuffer("image/png");
}

async function main(): Promise<void> {
  console.log("Omni3D — real Frame Sampler (variance of Laplacian)\n");

  // 1) The metric itself, on synthetic pixel arrays (no I/O).
  const sharpVol = varianceOfLaplacian(checkerboard(), W, H);
  const smoothVol = varianceOfLaplacian(gradient(), W, H);
  assert.ok(sharpVol > smoothVol * 50, "VoL separates sharp from smooth");
  console.log(`  ✓ metric: sharp VoL=${sharpVol.toFixed(0)} >> smooth VoL=${smoothVol.toFixed(2)}`);

  // 2) Real PNGs decoded through the provider.
  const sharpPng = await makeImage(true);
  const blurPng = await makeImage(false);
  const req = CreatePipelineRequest.parse({
    video: { uri: "asset://uploads/clip.mp4", container: "mp4", durationSec: 5, fps: 30, resolution: [1920, 1080] },
    targets: { engine: "ue5", polyBudget: "hero", rigStandard: "ue5_sk_mannequin" },
  });
  const job = buildJobEnvelope(req);
  const frames: FrameInput[] = [
    { idx: 0, tSec: 0.0, image: sharpPng },
    { idx: 1, tSec: 0.5, image: blurPng },
  ];
  const payload = (await realFrameSampler(job, frames)) as {
    $omni3d: string;
    selectedFrames: { idx: number }[];
    rejectedFrames: { idx: number }[];
    sfm: { solver: string };
  };
  assert.equal(payload.$omni3d, "loopA.frameSampler.out/v1", "valid FrameSampler payload");
  const kept = payload.selectedFrames.map((f) => f.idx);
  const rejected = payload.rejectedFrames.map((f) => f.idx);
  assert.ok(kept.includes(0), "sharp frame kept");
  assert.ok(rejected.includes(1), "blurred frame rejected");
  console.log(`  ✓ realFrameSampler kept ${JSON.stringify(kept)}, rejected ${JSON.stringify(rejected)}`);

  // 3) DI seam: the runner accepts the real provider in place of the synthetic A1.
  const result = await advanceJob(job, {}, { A1: (j) => realFrameSampler(j, frames) });
  assert.equal(result.kind, "advanced", "advance succeeded");
  if (result.kind === "advanced") {
    assert.equal(result.emitted.$omni3d, "loopA.frameSampler.out/v1", "runner emitted A1 payload");
    assert.equal((result.emitted as { sfm: { solver: string } }).sfm.solver, "sharpness_only", "used the real provider");
  }
  console.log("  ✓ runner accepts the injected real provider (DI seam)");

  console.log("\nSAMPLER SMOKE PASS");
}

main().catch((err: unknown) => {
  console.error("SAMPLER SMOKE FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
