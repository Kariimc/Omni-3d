import { z } from "zod";
import { EitlEngine, JobId } from "./common";

/** Loop C — Engine-in-the-Loop Compiler (EITL). Validate -> micro-repair -> live-sync. */

export const EitlValidation = z
  .object({
    $omni3d: z.literal("loopC.eitl.validation/v1"),
    jobId: JobId,
    loop: z.literal("C_eitl"),
    engineRules: z
      .object({ engine: EitlEngine, headless: z.boolean(), rulesetVersion: z.string() })
      .strict(),
    costFunction: z
      .object({
        formula: z.string(),
        weights: z
          .object({ w1: z.number(), w2: z.number(), w3: z.number() })
          .strict(),
        terms: z
          .object({
            L_manifold: z.number(),
            L_intersections: z.number(),
            L_vertex_tear: z.number(),
          })
          .strict(),
        score: z.number(),
        threshold: z.number(),
        passed: z.boolean(),
      })
      .strict(),
    checks: z
      .object({
        watertight: z.boolean(),
        normalsAligned: z.boolean(),
        delit: z.boolean(),
        vertexTearOnPlayback: z.boolean(),
        uvOverlapSecondary: z.boolean(),
      })
      .strict(),
    microRepair: z
      .object({
        triggered: z.boolean(),
        failureSites: z.array(z.unknown()),
        inpaintPasses: z.number().int(),
        rerunPhases: z.array(z.string()),
      })
      .strict(),
    export: z
      .object({
        ue5: z
          .object({
            materialInstances: z.boolean(),
            ormPacked: z.boolean(),
            emissiveScalarParam: z.number(),
            unitScaleCm: z.boolean(),
          })
          .strict(),
        unity: z
          .object({
            pipeline: z.enum(["urp", "hdrp"]),
            lightmapUV: z.boolean(),
            noVertexTearMecanim: z.boolean(),
          })
          .strict(),
      })
      .strict(),
    liveSync: z
      .object({
        bridge: z.string(),
        endpoint: z.string().url(),
        engine: EitlEngine,
        pushStatus: z.string(),
        instantiatedMaterials: z.boolean(),
      })
      .strict(),
  })
  .strict();

export type EitlValidation = z.infer<typeof EitlValidation>;
