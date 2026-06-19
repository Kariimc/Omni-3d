import {
  AnimationRetarget,
  EitlValidation,
  FrameSampler,
  type PipelineJob,
  Retopology,
  RiggingSkinWeights,
  type StagePayload,
  VoxelDraft,
} from "../schemas";

/** Deterministic stage generators. They emit schema-valid payloads derived from the
 *  job's request (no real ML) — functional stand-ins for the Phase 1/2/3 networks. */

export interface AdvanceOpts {
  /** Inject a defect into Loop C to exercise the EITL micro-repair back-edge. */
  defect?: "manifold" | "intersections" | "vertex_tear";
}

const r6 = (n: number): number => Math.round(n * 1e6) / 1e6;

const QUAD_TARGET: Record<PipelineJob["targets"]["polyBudget"], number> = {
  mobile_xr: 5000,
  hero: 32000,
  nanite: 120000,
};

// ---- Loop A ---------------------------------------------------------------

export function genFrameSampler(job: PipelineJob): StagePayload {
  const v = job.inputs.video;
  return FrameSampler.parse({
    $omni3d: "loopA.frameSampler.out/v1",
    jobId: job.jobId,
    loop: "A_structural",
    source: { uri: v.uri, fps: v.fps, frames: Math.round(v.durationSec * v.fps) },
    sfm: {
      solver: "colmap",
      intrinsics: { model: "PINHOLE", fx: 1462.3, fy: 1462.3, cx: 960.0, cy: 540.0 },
      reprojectionErrorPx: 0.48,
      registeredFrames: 84,
    },
    sharpnessThreshold: 0.62,
    selectedFrames: [
      { idx: 12, tSec: 0.4, sharpness: 0.91, blurRejected: false, camera: { position: [0.0, 1.2, 3.4], quat: [0.0, 0.0, 0.0, 1.0], fovDeg: 49.1 } },
      { idx: 31, tSec: 1.03, sharpness: 0.88, blurRejected: false, camera: { position: [2.1, 1.2, 2.6], quat: [0.0, 0.34, 0.0, 0.94], fovDeg: 49.1 } },
      { idx: 58, tSec: 1.93, sharpness: 0.84, blurRejected: false, camera: { position: [3.3, 1.2, 0.1], quat: [0.0, 0.7, 0.0, 0.7], fovDeg: 49.1 } },
    ],
    rejectedFrames: [
      { idx: 22, tSec: 0.73, sharpness: 0.21, blurRejected: true, reason: "motion_blur" },
    ],
    nextStage: "loopA.voxelDraft",
  });
}

export function genVoxelDraft(job: PipelineJob): StagePayload {
  const tweak = job.features.voxelDraftTweaker;
  const asym = job.features.asymmetricalFusion;
  return VoxelDraft.parse({
    $omni3d: "loopA.voxelDraft/v1",
    jobId: job.jobId,
    loop: "A_structural",
    generationProgress: 0.3,
    octree: {
      format: "sparse_voxel_octree",
      maxDepth: 9,
      resolution: [256, 256, 256],
      occupiedVoxels: 184213,
      bboxMin: [-0.55, 0.0, -0.4],
      bboxMax: [0.55, 1.85, 0.4],
      uri: `asset://${job.jobId}/voxel_draft.svo`,
    },
    userEdits: {
      brushStrokes: tweak
        ? [
            { tool: "carve", radius: 0.04, strength: 0.8, path: [[0.12, 1.3, 0.2], [0.14, 1.28, 0.21], [0.16, 1.26, 0.22]] },
            { tool: "smooth", radius: 0.06, strength: 0.5, path: [[-0.2, 0.9, 0.1], [-0.18, 0.88, 0.11]] },
          ]
        : [],
      asymmetry: {
        enabled: asym,
        mirrorOverride: asym,
        regions: asym
          ? [{ name: "left_pauldron", axis: "x", lockMirror: false, note: "battle-damaged, non-mirrored" }]
          : [],
      },
    },
    latentWeightDeltas: `asset://${job.jobId}/latent_delta_a2.npz`,
    nextStage: "loopA.retopology",
  });
}

export function genRetopology(job: PipelineJob): StagePayload {
  const preset = job.targets.polyBudget;
  const target = QUAD_TARGET[preset];
  const base = `asset://${job.jobId}/pbr`;
  return Retopology.parse({
    $omni3d: "loopA.retopology.io/v1",
    jobId: job.jobId,
    loop: "A_structural",
    input: { highFiMesh: `asset://${job.jobId}/mesh_highfi.glb`, triangles: 1842300, extraction: "flexicubes" },
    polyBudget: { preset, targetQuads: target, achievedQuads: Math.round(target * 0.984), quadDominancePct: 96.4 },
    curvatureField: { type: "anisotropic_cross_field", alignment: "principal_curvature", singularities: 14, smoothnessLambda: 0.35 },
    uvSeams: {
      userPainted: job.features.uvSeamPainter,
      immutableSeams: job.features.uvSeamPainter
        ? [{ name: "waist", polyline: [[0.0, 0.95, 0.4], [0.2, 0.95, 0.3], [0.0, 0.95, -0.4]] }]
        : [],
      islands: 7,
      stretchPct: 2.1,
      packingEfficiencyPct: 88.0,
      secondaryUV: true,
    },
    pbr: {
      inverseRender: "spherical_harmonics_l2",
      delit: job.features.pbrDelight,
      resolution: 4096,
      emissiveTerms: job.features.emissiveMapping ? ["rune gems", "blue glow"] : [],
      maps: {
        albedo: `${base}/albedo.png`,
        normal: `${base}/normal.png`,
        roughness: `${base}/roughness.png`,
        metallic: `${base}/metallic.png`,
        emissive: `${base}/emissive_mask.png`,
      },
    },
    watertight: { manifold: true, holes: 0, nonManifoldEdges: 0, zeroThicknessSheets: 0 },
    nextStage: "loopB.rigging",
  });
}

// ---- Loop B ---------------------------------------------------------------

export function genRigging(job: PipelineJob): StagePayload {
  const rig = job.targets.rigStandard;
  return RiggingSkinWeights.parse({
    $omni3d: "loopB.rigging.skinWeights/v1",
    jobId: job.jobId,
    loop: "B_rigging",
    input: { retopoMesh: `asset://${job.jobId}/mesh_retopo.glb`, vertices: 31840 },
    rigStandard: rig,
    jointPrediction: { model: "volumetric_gnn", voxelGrid: [64, 64, 64], confidence: 0.93 },
    skeleton: {
      root: "root",
      boneCount: 67,
      namingConvention: rig,
      bones: [
        { name: "root", parent: null, head: [0.0, 0.0, 0.0], tail: [0.0, 0.02, 0.0] },
        { name: "pelvis", parent: "root", head: [0.0, 0.95, 0.0], tail: [0.0, 1.02, 0.0] },
        { name: "spine_01", parent: "pelvis", head: [0.0, 1.02, 0.0], tail: [0.0, 1.14, 0.0] },
        { name: "spine_02", parent: "spine_01", head: [0.0, 1.14, 0.0], tail: [0.0, 1.28, 0.0] },
        { name: "spine_03", parent: "spine_02", head: [0.0, 1.28, 0.0], tail: [0.0, 1.42, 0.0] },
        { name: "clavicle_l", parent: "spine_03", head: [0.04, 1.4, 0.0], tail: [0.16, 1.42, 0.0] },
        { name: "upperarm_l", parent: "clavicle_l", head: [0.16, 1.42, 0.0], tail: [0.16, 1.16, 0.0] },
        { name: "lowerarm_l", parent: "upperarm_l", head: [0.16, 1.16, 0.0], tail: [0.16, 0.92, 0.0] },
        { name: "hand_l", parent: "lowerarm_l", head: [0.16, 0.92, 0.0], tail: [0.16, 0.8, 0.0] },
      ],
    },
    skinWeighting: {
      method: "volumetric_heat_diffusion",
      maxInfluencesPerVertex: 4,
      normalized: true,
      sample: [
        { vertex: 10422, influences: [{ bone: "upperarm_l", weight: 0.71 }, { bone: "lowerarm_l", weight: 0.21 }, { bone: "clavicle_l", weight: 0.08 }] },
        { vertex: 20488, influences: [{ bone: "spine_02", weight: 0.55 }, { bone: "spine_03", weight: 0.3 }, { bone: "spine_01", weight: 0.15 }] },
      ],
    },
    nextStage: "loopB.animationRetarget",
  });
}

export function genAnimation(job: PipelineJob): StagePayload {
  const rig = job.targets.rigStandard;
  const mv = job.inputs.motionVideo;
  const motionSource = mv
    ? { uri: mv.uri, fps: mv.fps, frames: Math.round(mv.durationSec * mv.fps) }
    : { uri: `asset://${job.jobId}/idle_generated.mov`, fps: 30, frames: 60 };
  return AnimationRetarget.parse({
    $omni3d: "loopB.animation.retarget/v1",
    jobId: job.jobId,
    loop: "B_rigging",
    motionSource,
    capture: { model: "wham_hmr", jointCount: 51, worldGrounded: true, trajectorySmoothness: 0.92 },
    retarget: {
      from: "wham_51",
      to: rig,
      ikSolver: "analytical_two_bone",
      footLock: { enabled: true, groundPlaneY: 0.0, slideResidualCm: 0.3, jitterSuppression: 0.85 },
    },
    bakedClip: {
      name: mv ? "walk_cycle" : "idle",
      format: "fbx_animstack",
      fps: 30,
      durationSec: mv ? 2.0 : 1.0,
      keyframeCount: mv ? 61 : 31,
      uri: `asset://${job.jobId}/anim.fbx`,
      tracks: [
        { bone: "pelvis", keys: [{ t: 0.0, pos: [0.0, 0.95, 0.0], rot: [0.0, 0.0, 0.0, 1.0] }, { t: 1.0, pos: [0.0, 0.93, 0.42], rot: [0.0, 0.04, 0.0, 0.999] }] },
        { bone: "thigh_l", keys: [{ t: 0.0, rot: [0.2, 0.0, 0.0, 0.979] }, { t: 0.5, rot: [-0.18, 0.0, 0.0, 0.983] }] },
      ],
    },
    nextStage: "loopC.eitl",
  });
}

// ---- Loop C — EITL gate + micro-repair back-edge --------------------------

const W = { w1: 0.4, w2: 0.35, w3: 0.25 } as const;
const THRESHOLD = 0.05;
const MAX_REPAIR = 3;
const REPAIR_FACTOR = 0.1; // localized inpaint removes ~90% of the defect at the failure site

interface Terms {
  L_manifold: number;
  L_intersections: number;
  L_vertex_tear: number;
}

const score = (t: Terms): number =>
  W.w1 * t.L_manifold + W.w2 * t.L_intersections + W.w3 * t.L_vertex_tear;

const worstTerm = (t: Terms): keyof Terms => {
  const c: Record<keyof Terms, number> = {
    L_manifold: W.w1 * t.L_manifold,
    L_intersections: W.w2 * t.L_intersections,
    L_vertex_tear: W.w3 * t.L_vertex_tear,
  };
  return (Object.keys(c) as (keyof Terms)[]).reduce((a, b) => (c[b] > c[a] ? b : a));
};

export function genEitl(job: PipelineJob, opts: AdvanceOpts = {}): StagePayload {
  const engine = job.targets.engine === "both" ? "ue5" : job.targets.engine;
  const terms: Terms = { L_manifold: 0.0, L_intersections: 0.02, L_vertex_tear: 0.0 };
  if (opts.defect === "manifold") terms.L_manifold = 0.3;
  if (opts.defect === "intersections") terms.L_intersections = 0.3;
  if (opts.defect === "vertex_tear") terms.L_vertex_tear = 0.3;

  const failureSites: { term: keyof Terms; before: number }[] = [];
  const rerunPhases: string[] = [];
  let passes = 0;
  let s = score(terms);

  // Back-edge: while over threshold, mask the worst site and re-run Phase 2/3 locally.
  while (s > THRESHOLD && passes < MAX_REPAIR) {
    passes++;
    const worst = worstTerm(terms);
    failureSites.push({ term: worst, before: r6(terms[worst]) });
    terms[worst] = r6(terms[worst] * REPAIR_FACTOR);
    rerunPhases.push(worst === "L_vertex_tear" ? "phase3_rig" : "phase2_topology");
    s = score(terms);
  }
  const passed = s <= THRESHOLD;

  return EitlValidation.parse({
    $omni3d: "loopC.eitl.validation/v1",
    jobId: job.jobId,
    loop: "C_eitl",
    engineRules: { engine, headless: true, rulesetVersion: engine === "ue5" ? "5.4" : "2022.3" },
    costFunction: {
      formula: "w1*L_manifold + w2*L_intersections + w3*L_vertex_tear",
      weights: { w1: W.w1, w2: W.w2, w3: W.w3 },
      terms: { L_manifold: terms.L_manifold, L_intersections: terms.L_intersections, L_vertex_tear: terms.L_vertex_tear },
      score: r6(s),
      threshold: THRESHOLD,
      passed,
    },
    checks: {
      watertight: terms.L_manifold <= THRESHOLD,
      normalsAligned: true,
      delit: true,
      vertexTearOnPlayback: terms.L_vertex_tear > THRESHOLD,
      uvOverlapSecondary: false,
    },
    microRepair: { triggered: passes > 0, failureSites, inpaintPasses: passes, rerunPhases },
    export: {
      ue5: { materialInstances: true, ormPacked: true, emissiveScalarParam: 2.5, unitScaleCm: job.targets.unitScale === "cm" },
      unity: { pipeline: "urp", lightmapUV: true, noVertexTearMecanim: true },
    },
    liveSync: {
      bridge: "websocket",
      endpoint: "ws://127.0.0.1:8788/omni3d",
      engine,
      pushStatus: passed ? "streaming" : "halted",
      instantiatedMaterials: passed,
    },
  });
}
