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
| `src/loops/*` | Synthetic stage generators + the A→B→C runner (injectable providers) |
| `src/loops/providers/*` | Real stage impls: VoL frame sampler, meshoptimizer retopology, mesh-integrity EITL, bone-heat skin weights |
| `src/live/*` | Live-Sync protocol, pub/sub bus (memory · Postgres · Supabase Realtime), client + bridge |
| `src/live-client.ts` | CLI that watches a job over `/live` and runs the engine actions |
| `public/*` | Live web dashboard (3-phase workspace) served at `GET /` |
| `supabase/migrations/*` | `jobs` + `job_stages` table DDL |

## API
| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/` | live web dashboard (3-phase workspace, consumes `/live`) |
| `GET` | `/health` | liveness + active store + schema count |
| `GET` | `/schemas` | list payload contracts the API validates against |
| `POST` | `/pipeline` | validate request → build job envelope → persist (201) |
| `GET` | `/jobs` | recent jobs (`?limit=`) |
| `GET` | `/jobs/:id` | fetch a job envelope (404 if absent) |
| `POST` | `/jobs/:id/advance` | run the next stage; `?defect=` injects an EITL failure to test repair |
| `GET` | `/jobs/:id/stages` | list the stage payloads emitted by the runner |
| `POST` | `/jobs/:id/stages` | validate an externally produced stage payload (discriminated union) |
| `GET` | `/jobs/:id/events` | durable event log (`?from=<seq>`) |
| `WS` | `/live?jobId=&from=` | replay history from `seq` then stream live (Feature #10) |

```
npm start              # boot the API (PORT=8787, in-memory store by default)
npm run smoke          # inject-based route tests, no network/credentials needed
```
Set `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (see `.env.example`) to persist jobs in Supabase;
apply the migrations in `supabase/migrations/` first.

## Loop runner
`POST /jobs/:id/advance` drives the job one stage at a time along the canonical chain
A1→A2→A3→B1→B2→C, emitting a schema-valid payload per step and updating `loops[*]`
status/progress. Loop C runs the EITL gate `E = w1·manifold + w2·intersections + w3·vertex_tear`;
if `E > T` it masks the worst failure site and re-runs Phase 2/3 locally (the micro-repair
back-edge), recording each pass in `microRepair`. Add `?defect=vertex_tear|intersections|manifold`
to force a failure and watch the repair loop recover.

### Real stage providers
Each stage generator is deterministic by default but swappable: `advanceJob(job, opts, overrides)`
takes a `{ stageKey: provider }` map (providers may be async). The first real one is
`realFrameSampler` (`src/loops/providers/`) — it decodes frames with jimp and scores each by the
**variance of the Laplacian** (the standard blur metric), rejecting frames below a relative
threshold, then emits the canonical `FrameSampler` payload. The CV core is pure (testable on raw
pixel arrays); SfM camera poses remain synthetic until COLMAP is wired. `npm run smoke:sampler`
verifies the metric, real-PNG blur rejection, and the runner DI seam.

The second real provider is `realRetopology` (Loop A3) — actual triangle **decimation via
`meshoptimizer` (WASM)** to the job's poly budget, reporting real input/achieved counts. (Quad
cross-field, UV seams, and PBR remain a separate pass.) `npm run smoke:retopo` decimates an ~80k-tri
sphere to the budget and checks the counts + the runner DI seam at A3.

The third is `realEitl` (Loop C, `mesh-check.ts`) — real **watertight/manifold analysis** (counts
faces per edge to find boundary/non-manifold edges + degenerate faces), feeding the measured defect
ratios into the shared `runEitlGate` (one EITL implementation for synthetic and real). A real hole
drives `L_manifold` over threshold and triggers the micro-repair back-edge. `npm run smoke:mesh`
checks closed/holed/non-manifold detection and the runner DI seam at C.

The fourth is `realSkinWeights` (Loop B, `skin-weights.ts`) — **bone-heat skin weights** (Baran &
Popović): each vertex is assigned to its nearest bone segment, then per bone the heat-equilibrium
system `(L + H)·w = H·p` is solved over the mesh graph Laplacian by Gauss-Seidel. Weights are a
partition of unity by construction (`L·1 = 0`); the heat term is edge-length-normalized for scale
invariance. `npm run smoke:skin` checks partition of unity, per-bone locality, a monotonic falloff
along a tube, a genuinely blended bone junction, and the runner DI seam at B1.

## Live-Sync bridge (Feature #10)
Connect a UE5/Unity client to `ws://host/live?jobId=<id>`; every `advance` then streams typed
events on that channel:
- `connected` — subscription ack
- `stage.completed` — per stage: `{ stage, done, status, loops }`
- `eitl.result` — Loop C gate: `{ passed, score, threshold, repairs, rerunPhases }`
- `asset.push` — on pass: `{ engine, bundle, endpoint }` (instantiate materials, push the mesh)
- `pipeline.complete` — terminal `{ status }`

The contract is a single discriminated union (`src/live/events.ts`), also exported to
`schemas/json/live-event.schema.json` for the engine-side client.

### Engine-side client
`LiveSyncClient` (`src/live/client.ts`) connects, validates each frame against `LiveEvent`,
and dispatches to typed handlers. On `asset.push` an `EngineBridge` runs the concrete engine
operations — for UE5: create Material Instance from the master, assign BaseColor/Normal/ORM/Emissive,
import the SkeletalMesh at 1 unit = 1 cm, bind the AnimBlueprint, open Live Link (Unity has the
URP/Mecanim equivalents). Watch any running job live:
```
npm run live:client -- <jobId> --url=ws://127.0.0.1:8787 [--from=<seq>]
```

### Durability & replay
Every emitted event is persisted to a durable log with a monotonic `seq` (in-memory by default,
`job_events` table under Supabase). On connect, `/live` **replays** the log from `?from=<seq>`
(default 0 = full history) and then streams live — subscribing *before* it reads the log so no
event is missed in the gap. A dropped client resumes with `{ from: client.lastSeq }`; late joiners get the whole history.

### Scaling across instances
The `EventBus` (`src/live/bus.ts`) is the broadcast seam; the durable log still backs replay.
`InMemoryEventBus` is the default (single process). Two multi-instance adapters implement the
same interface:
- `PostgresNotifyEventBus` (`src/live/pg-bus.ts`) — one channel, `pg_notify` to fan out.
  `EVENT_BUS=pg` + `DATABASE_URL` (direct/session connection).
- `SupabaseRealtimeEventBus` (`src/live/supabase-bus.ts`) — over WSS, native for serverless/
  Supabase. `EVENT_BUS=supabase` + `SUPABASE_URL`/service key.

`npm run smoke:bus` verifies cross-instance fan-out for both against fakes offline, and runs the
real LISTEN/NOTIFY and Realtime tests when the respective env is set.

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
