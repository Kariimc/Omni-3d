import assert from "node:assert/strict";
import { type MotionClip, realRetarget, retargetClip } from "./loops/providers/retarget";
import { advanceJob } from "./loops/runner";
import { buildJobEnvelope, CreatePipelineRequest } from "./schemas";

type V3 = [number, number, number];

// Deterministic pseudo-noise in [-1, 1] for repeatable root jitter.
const noise = (i: number): number => {
  const f = Math.sin(i * 12.9898) * 43758.5453;
  return (f - Math.floor(f)) * 2 - 1;
};

// A 2-second walk: feet alternate stance, the planted foot deliberately slides ~12cm,
// and the root drifts forward with ~1cm per-frame jitter.
function walk(): MotionClip {
  const fps = 30;
  const frames = 60;
  const root: V3[] = [];
  const left: V3[] = [];
  const right: V3[] = [];
  const swingY = (phase: number): number => 0.04 + 0.1 * Math.sin(Math.PI * phase); // airborne, min 0.04 > eps
  for (let i = 0; i < frames; i++) {
    root.push([0.01 * noise(i), 0.95, (0.4 * i) / (frames - 1) + 0.01 * noise(i + 99)]);
    if (i < 30) {
      left.push([-0.1, 0, 0.1 + 0.12 * (i / 29)]); // planted, sliding forward 12cm
      right.push([0.1, swingY(i / 30), 0.1 + 0.3 * (i / 29)]); // swinging
    } else {
      left.push([-0.1, swingY((i - 30) / 30), 0.1 + 0.3 * ((i - 30) / 29)]);
      right.push([0.1, 0, 0.25 + 0.12 * ((i - 30) / 29)]); // planted, sliding 12cm
    }
  }
  return { fps, root, feet: [{ bone: "foot_l", pos: left }, { bone: "foot_r", pos: right }] };
}

type Retarget = {
  $omni3d: string;
  capture: { trajectorySmoothness: number };
  retarget: { to: string; footLock: { enabled: boolean; groundPlaneY: number; slideResidualCm: number; jitterSuppression: number } };
  bakedClip: { fps: number; keyframeCount: number; tracks: { bone: string; keys: { t: number; pos?: V3; rot: number[] }[] }[] };
};

function maxHorizDev(points: V3[]): number {
  let cx = 0;
  let cz = 0;
  for (const p of points) {
    cx += p[0];
    cz += p[2];
  }
  cx /= points.length;
  cz /= points.length;
  let m = 0;
  for (const p of points) m = Math.max(m, Math.hypot(p[0] - cx, p[2] - cz));
  return m;
}

async function main(): Promise<void> {
  console.log("Omni3D — real animation retarget (foot-lock IK + smoothing)\n");

  const clip = walk();
  const a = retargetClip(clip, { lockStrength: 0.9, smoothWindow: 5 });

  assert.equal(a.groundPlaneY, 0, "ground plane detected at the foot floor");
  assert.equal(a.stancePhases, 2, "detected both stance phases (one per foot)");
  assert.ok(a.originalSlideCm > 3, `measured real foot slide (${a.originalSlideCm}cm)`);
  assert.ok(a.residualSlideCm < a.originalSlideCm && a.residualSlideCm < 1, "foot-lock removed most of the slide");
  console.log(`  ✓ foot-lock: ${a.stancePhases} stance phases, slide ${a.originalSlideCm}cm → ${a.residualSlideCm}cm`);

  assert.ok(a.trajectorySmoothness > 0.3 && a.trajectorySmoothness <= 1, `smoothing reduced root accel (${a.trajectorySmoothness})`);
  assert.ok(a.jitterSuppression > 0.3 && a.jitterSuppression <= 1, `peak jitter suppressed (${a.jitterSuppression})`);
  console.log(`  ✓ smoothing: trajectorySmoothness=${a.trajectorySmoothness}, jitterSuppression=${a.jitterSuppression}`);

  const req = CreatePipelineRequest.parse({
    video: { uri: "asset://uploads/clip.mp4", container: "mp4", durationSec: 5, fps: 30, resolution: [1920, 1080] },
    targets: { engine: "ue5", polyBudget: "hero", rigStandard: "ue5_sk_mannequin" },
  });
  const job = buildJobEnvelope(req);

  const payload = realRetarget(job, clip, { lockStrength: 0.9 }) as Retarget;
  assert.equal(payload.$omni3d, "loopB.animation.retarget/v1", "emits the retarget payload");
  assert.equal(payload.retarget.to, "ue5_sk_mannequin", "retargeted to the job's rig");
  assert.equal(payload.retarget.footLock.enabled, true, "foot-lock enabled");
  assert.equal(payload.retarget.footLock.slideResidualCm, a.residualSlideCm, "payload reports the measured residual");
  assert.equal(payload.capture.trajectorySmoothness, a.trajectorySmoothness, "payload reports the measured smoothness");
  assert.equal(payload.bakedClip.keyframeCount, 60, "all frames baked");
  assert.equal(payload.bakedClip.tracks.length, 3, "root + 2 foot tracks");
  for (const tr of payload.bakedClip.tracks) assert.equal(tr.keys.length, 60, `${tr.bone} has a key per frame`);
  console.log(`  ✓ payload: ${payload.bakedClip.tracks.length} tracks × ${payload.bakedClip.keyframeCount} keys`);

  // the baked left-foot stance is actually pinned in the output (slide ~ residual)
  const leftStance = payload.bakedClip.tracks.find((t) => t.bone === "foot_l")!.keys.slice(0, 30).map((k) => k.pos!);
  const bakedSlideCm = maxHorizDev(leftStance) * 100;
  assert.ok(bakedSlideCm < 1, `baked stance foot is pinned (${bakedSlideCm.toFixed(2)}cm)`);
  console.log(`  ✓ baked output verified: planted foot slide ${bakedSlideCm.toFixed(2)}cm`);

  // DI seam: drive the runner to B2 with the real retarget injected
  let cur = job;
  let emitted: Retarget = { $omni3d: "" } as Retarget;
  for (let i = 0; i < 5; i++) {
    const r = await advanceJob(cur, {}, { B2: (j) => realRetarget(j, clip) });
    assert.equal(r.kind, "advanced", `advance ${i} ok`);
    if (r.kind === "advanced") {
      cur = r.job;
      emitted = r.emitted as unknown as Retarget;
    }
  }
  assert.equal(emitted.$omni3d, "loopB.animation.retarget/v1", "runner reached B2");
  assert.equal(emitted.retarget.footLock.enabled, true, "runner used the real retarget provider");
  console.log("  ✓ runner accepts the injected real retarget at B2 (DI seam)");

  console.log("\nRETARGET SMOKE PASS");
}

main().catch((err: unknown) => {
  console.error("RETARGET SMOKE FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
