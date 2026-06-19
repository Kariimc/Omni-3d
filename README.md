# Omni3D

**Video-native 3D production studio with automated rigging — UE5 & Unity native.**

Feed it text, an image, or a 2D phone video. Omni3D rebuilds the object in 3D, retopologizes to a
clean quad mesh, de-lights its textures, drops a working skeleton inside it, copies motion from a
second video onto that skeleton, validates the result against real game-engine rules, repairs its
own mistakes, and live-syncs the finished asset straight into Unreal or Unity.

## The 3 closed loops
- **Loop A — Structural:** video → sharp-frame sampling → voxel draft (you can sculpt it) → quad
  retopology → de-lit PBR maps.
- **Loop B — Auto-Rig & Mocap:** predict skeleton (UE5 SK_Mannequin / Unity Humanoid) → smooth
  skin weights → capture motion from video → foot-lock IK → bake FBX.
- **Loop C — Engine-in-the-Loop Compiler:** headless UE/Unity rule check → `E = w1·manifold +
  w2·intersections + w3·vertex_tear` → auto micro-repair on failure → WebSocket live-sync push.

## Repo map
| Path | Deliverable |
|------|-------------|
| `docs/ARCHITECTURE.md` | Closed-loop flow diagram · network blueprint · 11-feature map · conformance check |
| `docs/payloads/*.json` | Example payload instances for every stage A1 → C |
| `docs/ui/WORKSPACE_WIREFRAME.md` | Unified 3-phase workspace UI layout |
| `src/schemas/*.ts` | **Zod schemas — single source of truth** (runtime validation, strict) |
| `src/validate.ts` | Validates every payload + verifies the closed-loop `nextStage` chain |
| `src/export-json-schema.ts` | Emits `schemas/json/*` from the Zod schemas |
| `schemas/json/*.schema.json` | Exported JSON Schema contracts for the UE5/Unity bridges |
| `src/app.ts` · `src/server.ts` | Fastify API (schema-validated) |
| `src/store/*` | Pluggable job store: in-memory default, Supabase adapter |
| `supabase/migrations/*` | `jobs` table DDL |

## API
| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/health` | liveness + active store + schema count |
| `GET` | `/schemas` | list payload contracts the API validates against |
| `POST` | `/pipeline` | validate request → build job envelope → persist (201) |
| `GET` | `/jobs` | recent jobs (`?limit=`) |
| `GET` | `/jobs/:id` | fetch a job envelope (404 if absent) |
| `POST` | `/jobs/:id/stages` | validate any Loop A/B/C payload via the discriminated union |

```
npm start              # boot the API (PORT=8787, in-memory store by default)
npm run smoke          # inject-based route tests, no network/credentials needed
```
Set `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (see `.env.example`) to persist jobs in Supabase;
apply `supabase/migrations/0001_init.sql` first.

## Payload data flow
```
pipeline.job → A1 frame_sampler → A2 voxel_draft → A3 retopology
            → B1 rigging_skinweights → B2 animation_retarget → C eitl_validation
```
Each payload carries `$omni3d`, `jobId`, `loop`, `nextStage` — a verifiable, self-correcting chain.

## Develop
```
npm install
npm run check          # typecheck + validate payloads + verify loop chain
npm run export:schema  # regenerate schemas/json/ from the Zod source of truth
```
