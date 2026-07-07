# WO-13 — Pro pipeline: public API on every tier, batch, ProRes/alpha, full 3D export

**Phase 3 · depends on WO-07, WO-08, WO-12 · branch `wo/13-pro-export-api`**

## Goal
Professional handoff: documented public API with keys on ALL tiers (free included), batch endpoints, ProRes 4444 export with alpha, and 3D export in glTF/GLB, FBX, OBJ, USDZ.

## Why
Community complaint #14: Higgsfield is MP4-only, no alpha, API gated behind high tiers with sparse docs — pros bounce to Runway. Omni 3D is already API-first; formalizing it is cheap and loud. 3D multi-format export is our exclusive.

## Read first
- `src/server.ts` + all routes added by prior WOs, `src/export-json-schema.ts` (schema export machinery), WO-05 auth (keys attach to users), WO-08/11 render paths (alpha needs transparent-background rendering), `@gltf-transform` usage from WO-01.

## Spec
1. **OpenAPI**: `@fastify/swagger` + existing Zod schemas (via `fastify-type-provider-zod` or zod-to-json-schema wiring) → `GET /openapi.json` + `/docs` UI. Every public route documented with examples.
2. **API keys**: `POST /keys` (auth'd) → `omni_live_…` token; header `X-Api-Key` accepted everywhere the JWT is; per-key rate limit (simple token bucket, env-tunable), NO tier gating — free-tier keys work.
3. **Batch**: `POST /batch {jobs: PipelinePayload[] | GenerateRequest[]}` (≤50) → parent job fanning out through the WO-03 queue; `GET /batch/:id` aggregates statuses; estimate covers the whole batch upfront.
4. **ProRes/alpha**: render paths accept `format: "mp4" | "webm" | "prores4444"`; for ProRes, render with transparent background (3D renders only) and encode `-c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le`.
5. **3D export**: `POST /export3d {assetUri, format: gltf|glb|obj|fbx|usdz}` — glTF/GLB/OBJ via `@gltf-transform` (+ simple OBJ writer); FBX + USDZ via Blender headless (`blender -b -P script`) when `OMNI3D_BLENDER_PATH` is set, else return `422 { reason: "blender required" }` with docs link. Never fake a format.
6. Update README with a "Use the API" quickstart (curl end-to-end: key → upload → pipeline → download).

## Acceptance
```bash
npm run check
npm run smoke:api        # NEW: /openapi.json validates (swagger-parser); key issued; keyed
                         # request passes where keyless fails; batch of 3 mock jobs completes
npm run smoke:export3d   # glb+gltf+obj real exports validate/parse; fbx/usdz honest-422 without Blender
# Manual with Blender (document): fbx opens in Blender import; prores clip: ffprobe shows
# prores 4444 + alpha (yuva444p10le) — paste ffprobe
```

## Out of scope
SDK packages, webhooks, Premiere/Resolve plugins, EXR sequences.
