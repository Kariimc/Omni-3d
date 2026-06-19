import { randomBytes } from "node:crypto";
import { z } from "zod";
import { AssetUri, Engine, PolyBudgetPreset, RigStandard, UnitScale } from "./common";
import { Features, MotionVideoInput, PipelineJob, VideoInput } from "./job";

/** Client-facing request for POST /pipeline. Server fields (jobId, status, loops,
 *  artifacts...) are assigned by buildJobEnvelope, not accepted from the client. */
export const CreatePipelineRequest = z
  .object({
    text: z.string().default(""),
    images: z.array(AssetUri).default([]),
    video: VideoInput,
    motionVideo: MotionVideoInput.optional(),
    targets: z
      .object({
        engine: Engine,
        unitScale: UnitScale.default("cm"),
        polyBudget: PolyBudgetPreset,
        humanoid: z.boolean().default(true),
        rigStandard: RigStandard,
      })
      .strict(),
    features: Features.partial().default({}),
  })
  .strict();

export type CreatePipelineRequest = z.infer<typeof CreatePipelineRequest>;

const DEFAULT_FEATURES: z.infer<typeof Features> = {
  voxelDraftTweaker: true,
  asymmetricalFusion: false,
  polyBudgetRetopo: true,
  uvSeamPainter: true,
  pbrDelight: true,
  watertightScanner: true,
  kitbash: false,
  emissiveMapping: true,
  styleAnchors: false,
  liveSync: true,
  autoRigMocap: true,
};

export function newJobId(): string {
  return "job_" + Date.now().toString(36).toUpperCase() + randomBytes(4).toString("hex");
}

/** Build a fully-populated, schema-valid job envelope from a validated request. */
export function buildJobEnvelope(
  req: CreatePipelineRequest,
  owner = "user_anon",
): PipelineJob {
  const id = newJobId();
  const base = `asset://${id}`;
  const envelope = {
    $omni3d: "pipeline.job/v1",
    jobId: id,
    createdAt: new Date().toISOString(),
    owner,
    status: "queued",
    inputs: {
      text: req.text,
      images: req.images,
      video: req.video,
      ...(req.motionVideo ? { motionVideo: req.motionVideo } : {}),
    },
    targets: req.targets,
    features: { ...DEFAULT_FEATURES, ...req.features },
    loops: {
      A_structural: { stage: "frame_sampler", progress: 0, status: "queued" },
      B_rigging: { stage: "rigging", progress: 0, status: "queued" },
      C_eitl: { stage: "eitl", progress: 0, status: "queued" },
    },
    artifacts: {
      voxelDraft: `${base}/voxel_draft.svo`,
      highFiMesh: `${base}/mesh_highfi.glb`,
      retopoMesh: `${base}/mesh_retopo.glb`,
      textures: `${base}/pbr/`,
      riggedMesh: `${base}/rigged.fbx`,
      animation: `${base}/anim.fbx`,
      engineBundle: `${base}/engine_bundle.uasset`,
    },
    runner: { cursor: -1, emitted: [], repairs: 0 },
  };
  // Re-parse so the response is guaranteed to satisfy the canonical contract.
  return PipelineJob.parse(envelope);
}
