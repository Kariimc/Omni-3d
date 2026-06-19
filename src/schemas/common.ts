import { z } from "zod";

/** Shared geometric + identifier primitives used across every loop payload. */

export const Vec3 = z.tuple([z.number(), z.number(), z.number()]);
export const Quat = z.tuple([z.number(), z.number(), z.number(), z.number()]);
export const Resolution2D = z.tuple([z.number().int(), z.number().int()]);
export const Resolution3D = z.tuple([z.number().int(), z.number().int(), z.number().int()]);

export const AssetUri = z.string().regex(/^asset:\/\/.+/, "must be an asset:// URI");
export const JobId = z.string().regex(/^job_[A-Za-z0-9]+$/, "must match job_<id>");

export const Engine = z.enum(["ue5", "unity", "both"]);
export const EitlEngine = z.enum(["ue5", "unity"]);
export const PolyBudgetPreset = z.enum(["mobile_xr", "hero", "nanite"]);
export const RigStandard = z.enum(["ue5_sk_mannequin", "unity_humanoid_mecanim"]);
export const BrushTool = z.enum(["carve", "draw", "smooth"]);
export const Axis = z.enum(["x", "y", "z"]);
export const LoopId = z.enum(["A_structural", "B_rigging", "C_eitl"]);
export const LoopStatus = z.enum(["queued", "running", "passed", "failed"]);
export const UnitScale = z.enum(["cm", "m"]);
export const VideoContainer = z.enum(["mp4", "mov"]);
