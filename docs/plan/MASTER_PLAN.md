# Omni 3D — Master Plan: the Higgsfield competitor

> Written 2026-07-05. Evidence: [RESEARCH_HIGGSFIELD.md](./RESEARCH_HIGGSFIELD.md).
> Build instructions for agents: [work-orders/](./work-orders/) — each file is self-contained.

## The one-line strategy

Higgsfield is a $500M-revenue model-aggregator that users **like but don't trust** (fake "unlimited," billing dark patterns, credit opacity) and that has **no 3D capability at all**. Omni 3D wins by being the **3D-native creative platform with honest economics**: everything Higgsfield users wish they had, anchored on the one thing Higgsfield can't copy quickly — a real video→game-ready-3D pipeline with a free local generation engine.

## Positioning

**"Own your assets. Own your compute. Own your characters — in 3D."**

Three attack vectors, all evidence-backed:

1. **Trust attack.** Higgsfield's Trustpilot is 3.2/5 over billing dark patterns, credit expiry, and the Dec-2025 "unlimited" mass bans. Omni 3D ships radically honest economics: flat pricing, rollover credits that never expire, failed generations never charged, and a truly unlimited local tier (your GPU, open models, zero per-asset cost — already partially built in the `omni3d` skill's `engine/`).
2. **3D attack.** Higgsfield's "Cinema Studio 4D" is a camera product, not 3D. Omni 3D's pipeline (video → mesh → retopo → rig → animate → engine-validated) produces assets Higgsfield structurally cannot: game-ready, engine-synced, re-renderable from any angle. This also solves their #11 community complaint (character drift) *by construction* — a rigged 3D character can't drift.
3. **Wish-list attack.** Ship the top 10 features the community begs Higgsfield for (below), each traced to evidence.

## Current state of the repo (verified 2026-07-05)

TypeScript + Fastify 5 + Zod, tsx (no build step), optional Supabase/pg. What's real:

- 6-stage closed-loop pipeline (A1→A2→A3→B1→B2→C) with real classic-CV providers behind `features.realPipeline`: blur-scored frame sampling, shape-from-silhouette voxel carving, meshoptimizer retopo, bone-heat skin weights, foot-lock IK retarget, watertight/manifold EITL checks with auto micro-repair. `npm run pipeline:real` → `status: passed`.
- REST API (`POST /pipeline`, `advance`, `GET /jobs/:id`) returning an artifact manifest.
- Live event bus (in-memory / Supabase / Postgres) + UE5/Unity bridge scaffolding (`src/live/`).
- Schema-first: every stage payload is a Zod schema exported to JSON Schema; `npm run check` = typecheck + validate + 11 smoke tests.
- Python free local engine (in the `omni3d` skill's `engine/`, to be merged into this repo): FLUX.1-schnell/SDXL text→image; MiDaS depth image→3D `.glb` (CPU-verified); TRELLIS/TripoSR GPU tier; mock backend for no-GPU CI.

**Gaps (the scaffold boundary):** artifacts are `asset://` manifest URIs, not files on disk — no upload/download layer; the "real" providers run real algorithms on **procedurally generated inputs** (`buildStageContext()`) — uploaded media never reaches the pipeline; DL reconstruction (NeRF/triplane, FlexiCubes, GNN joints, WHAM mocap, PBR delight) not wired; only a minimal live dashboard at `/` (`public/`), no full workspace UI; no auth, billing, queue/worker, or GPU orchestration; the Python engine and TS pipeline aren't connected.

## The Top 10 community-wished features (each traced to research Part 2)

| # | Feature | Higgsfield complaint it answers | Omni 3D implementation | Work order |
|---|---------|-------------------------------|------------------------|-----------|
| 1 | **True Unlimited (local-first)** | #1 fake unlimited, throttling, bans | Local engine tier: open models on the user's GPU, genuinely unlimited, watermark-free; hosted tier states real queue position honestly | WO-02, WO-14 |
| 2 | **Honest billing** | #2 annual-default checkout, refund obstruction | Flat monthly default, price shown as total charged, cancel-anytime, 30-day no-questions refund | WO-14 |
| 3 | **Credits that never expire + rollover + no charge on failure** | #3 90-day expiry, forfeit at renewal, paying for failed gens | Credits are a wallet, not a subscription hostage; failed jobs auto-refund at the queue layer | WO-03, WO-14 |
| 4 | **Live cost meter + pre-run estimate** | #4 hidden agent spend, silent toggle resets | `POST /estimate` before every job; running spend meter in UI; hard budget cap per job | WO-06 |
| 5 | **Native 4K path, upscaling included** | #5 720p/1080p caps, paid upscaling | Real-ESRGAN/ESRGAN-video local + hosted; included in every tier; 3D renders are resolution-free by nature | WO-12 |
| 6 | **Native audio + lipsync** | #6 no native audio | Audio stage in pipeline: TTS/music/SFX providers + lipsync onto rigged 3D heads (bone-driven visemes — better than pixel lipsync) | WO-10 |
| 7 | **Multi-shot scene editor / longer sequences** | #7 8-second cap, #10 no timeline | Scene-graph + timeline UI: sequence shots, reuse the same 3D assets across shots, export continuous video | WO-11 |
| 8 | **Character lock via 3D anchor** | #11 Soul ID drift across models/shots | The rigged 3D asset IS the character: re-render from any angle/motion with zero drift; export the character itself (glTF/FBX/USDZ) | WO-09 |
| 9 | **Camera-move preset library** | Table stakes (their most-praised feature) | 100+ camera paths as actual 3D camera curves over real 3D scenes — deterministic, not prompt-lottery; ~60–70% hit rate becomes ~100% | WO-08 |
| 10 | **Pro pipeline: API on all tiers, batch, ProRes/alpha, 3D export** | #14 MP4-only, gated API | Public API from the free tier up (API-first is already the repo's architecture); batch endpoints; ProRes 4444 + alpha; glTF/FBX/USDZ/OBJ | WO-13 |

Also addressed as policy (not code): #9 responsive support and #12 sane, non-retroactive content rules — written into TRUST.md as product commitments (WO-14).

## Feature-parity map (Higgsfield → Omni 3D answer)

| Higgsfield | Omni 3D answer | Phase |
|---|---|---|
| 15+ aggregated video/image models | Model gateway (fal.ai/Replicate adapters) + free local engine as tier zero | 2 |
| Soul / Soul ID | 3D character anchor (strictly stronger: exportable, angle-free, engine-ready) | 2 |
| DoP camera presets | Real 3D camera curves over reconstructed scenes | 2 |
| Speak / Lipsync Studio | Bone-driven viseme lipsync on rigged heads | 3 |
| Cinema Studio | Scene-graph timeline editor | 3 |
| UGC Factory / Ads | Later — template layer on top of scene editor (post-plan) | 4 |
| MCP + CLI | Already exists (omni3d skill drives the API); formalize in WO-13 | 1–3 |
| Premiere/Resolve plugins | Post-plan; ProRes/alpha export (WO-13) covers the handoff meanwhile | 4 |
| **(nothing)** | **Video→game-ready 3D pipeline, UE5/Unity live sync — the moat** | 0–1 |

## Architecture additions (target shape)

```
                    ┌────────────────────────────────────────────┐
  Web UI (Next.js)  │  API (Fastify, exists) ── queue (BullMQ/pg) │
  3D viewer, timeline│    │            │                          │
  cost meter        │    ▼            ▼                          │
                    │  Blob store   Workers                       │
                    │  (S3/Supabase) ├─ TS pipeline stages (exist)│
                    │               ├─ Python engine (image/mesh) │
                    │               └─ Model gateway (fal/Replicate)
                    └───────────────┬────────────────────────────┘
                                    ▼
                     Live bus (exists) → UE5 / Unity bridge
```

Principles: keep schema-first Zod contracts for every new surface; every WO extends `npm run check`; local-first parity — anything the hosted tier does, the local engine must at least approximate with open models.

## Roadmap (phases = dependency order, not calendar)

- **Phase 0 — Make it real end-to-end:** WO-01 (file I/O — real `.glb` on disk), WO-02 (Python engine ↔ TS pipeline bridge), WO-03 (durable job queue + progress events + auto-refund semantics). *Exit test: photo in → downloadable rigged `.glb` out, one command.*
- **Phase 1 — Product surface:** WO-04 (web workspace + 3D viewer), WO-05 (auth + projects), WO-06 (cost meter). *Exit test: a stranger signs up and produces an asset without reading docs.*
- **Phase 2 — Parity core:** WO-07 (model gateway), WO-08 (camera presets), WO-09 (3D character anchor). *Exit test: same character, 5 shots, 2 different video models, zero identity drift.*
- **Phase 3 — Wish-list finishers:** WO-10 (audio+lipsync), WO-11 (timeline), WO-12 (4K), WO-13 (pro export + public API), WO-14 (honest billing + TRUST.md). *Exit test: 30-second multi-shot 4K clip with audio, plus the character as an FBX, exported from one project.*

## Rules for builder agents

0. **Read [HANDOFF.md](./HANDOFF.md) before anything else**, and log your work in [BUILD_LEDGER.md](./BUILD_LEDGER.md) — that pair is how no context is ever lost between agents.
1. Read your work order fully, then read every repo file it names, **before writing code**.
2. Smallest change that works; follow existing patterns (Zod schema → provider → smoke test → wire into `npm run check`).
3. Every WO's acceptance criteria are commands with expected output — run them; paste output in your report. Green `npm run check` is mandatory before commit.
4. One WO = one branch (`wo/NN-slug`) = small single-purpose commits = draft PR. Do not merge to main.
5. If a WO's assumption no longer matches the repo, fix the WO file in the same PR and say so.
6. No new dependency unless the WO lists it or fifty plain lines can't do the job.

## Sequencing note for the owner

Phase 0 is the only truly serial part (everything needs real files + queue). After WO-03 lands, WO-04/05/06 can run in parallel, then Phase 2's three WOs in parallel, then Phase 3's five in parallel. With one agent per WO, the critical path is roughly: WO-01 → WO-02 → WO-03 → WO-04 → WO-09 → WO-11.
