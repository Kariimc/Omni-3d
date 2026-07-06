# BUILDER HANDOFF — read this before touching any code

> For every agent building a work order (WO). This is the zero-context-loss document:
> everything verified about this repo as of **2026-07-05**, the contracts you must not break,
> and the protocol that keeps knowledge from evaporating between agents and sessions.
>
> Reading order: **this file** → your WO file in [work-orders/](./work-orders/) → every repo
> file your WO names → [BUILD_LEDGER.md](./BUILD_LEDGER.md) (check what changed since this
> handoff was written). UI/site WOs also read [SITE_SPEC.md](./SITE_SPEC.md) (requirements) and
> [QUALITY_BAR.md](./QUALITY_BAR.md) (release budgets). If your work hits a known risk, the
> mandated fallback is in [PLAN_REVIEW.md](./PLAN_REVIEW.md) §2 — follow it, don't improvise.
> Strategy/evidence, only if you need the "why": [MASTER_PLAN.md](./MASTER_PLAN.md),
> [RESEARCH_HIGGSFIELD.md](./RESEARCH_HIGGSFIELD.md).

---

## 1. Verified baseline (reproduced on the owner's machine, 2026-07-05)

```bash
git clone https://github.com/Kariimc/Omni-3d.git && cd Omni-3d
npm install          # ~156 packages, seconds; warns about allow-scripts — ignore
npm run check        # GREEN: typecheck + validate + 11 smoke suites
npm run pipeline:real
```
Verified `npm run check` tail (your baseline before ANY change — if this isn't green for you, STOP and report, don't "fix" unrelated things):
```
  ✓ real run: 6 real stages → status passed
      A1 kept 2/4 frames | A2 3415 voxels | A3 20480→10000 tris | B1 heat_diffusion_geodesic | B2 slide 0.6cm | C E=0
  ✓ feature flag gates real vs synthetic (same runner, same loop chain)
E2E SMOKE PASS
```

## 2. Environment you're building on

- **Owner's dev box: Windows 11**, shell = Git Bash / PowerShell 5.1. Scripts you add must run under Git Bash; don't assume `sh` scripts run from PowerShell. Watch for CRLF: git warns `LF will be replaced by CRLF` — harmless, don't "fix" line endings in unrelated files.
- **Node 20+, tsx, NO build step** — `npm start` runs TypeScript directly (`tsx src/server.ts`). Never add a `dist/` compile step for the server; `tsc --noEmit` is typecheck-only.
- **gh CLI authenticated** as `Kariimc` (https). Remote: `https://github.com/Kariimc/Omni-3d.git`. Open PRs as **drafts**; never merge to main (owner's gate).
- Env vars (all optional — everything runs with zero infra): `PORT` (8787), `HOST`, `EVENT_BUS` (`memory`), `DATABASE_URL`, `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`. Source: `src/config.ts` (plain object, no validation lib — extend it there).
- Default persistence is **in-memory** (`createJobStore()` in `src/store/index.ts` picks Supabase only if BOTH supabase vars are set). Anything you build must work in-memory first; pg/Supabase is the upgrade path, never the requirement.

## 3. Repo map (what every path is for)

```
src/app.ts             buildApp(store, bus) — PURE FACTORY, no listen(); tests use app.inject()
src/server.ts          entrypoint: createJobStore() + buildApp() + listen(config.port)
src/config.ts          env → config object
src/schemas/           ALL wire contracts, Zod, strict(); index.ts = registry (see §4)
src/loops/runner.ts    advanceJob() — the one function that moves a job forward (see §5)
src/loops/generators.ts   synthetic per-stage generators (the non-real path; keep working!)
src/loops/providers/   REAL algorithm per stage: frame-sampler, voxel-carve, retopology,
                       skin-weights, retarget, mesh-check (+ sharpness helper)
src/loops/real-providers.ts  buildStageContext() + buildRealProviders() + runRealPipeline() (see §6)
src/live/bus.ts        EventBus interface + InMemoryEventBus (publish/subscribe per jobId)
src/live/events.ts     LiveEvent — THE wire protocol (discriminated union on "type", see §7)
src/live/{supabase-bus,pg-bus,factory}.ts   alternative bus backends
src/live/{client,engine}.ts   UE5/Unity bridge scaffolding
src/store/types.ts     JobStore interface (see §5); memory.ts / supabase.ts implement it
src/smoke-*.ts         one smoke per feature; ALL wired into `npm run check`
src/validate.ts        validates docs/payloads/*.json against the schema registry
src/export-json-schema.ts   Zod → JSON Schema exporter (docs/payloads source of truth)
public/                EXISTING live dashboard (index.html + dashboard.css/js) served at "/"
                       — a self-contained 3-phase workspace. The plan docs' claim "no UI"
                       is WRONG; there IS this dashboard. WO-04 builds the full workspace
                       in web/ but MUST NOT break "/" until it replaces it deliberately.
docs/payloads/         exported JSON Schemas + sample payloads (regenerate via export:schema)
docs/ARCHITECTURE.md   the target architecture (Loops A/B/C, EITL, back-edges) — read once
docs/ui/WORKSPACE_WIREFRAME.md   intended workspace layout for WO-04
supabase/migrations/   SQL migrations for the Supabase store
schemas/               (top-level) exported JSON Schema artifacts
```
Python engine (WO-02 merges it here as `engine/`): currently at `~/.claude/skills/omni3d/engine/` on the owner's machine — `omni_engine/` package with `cli.py`, `preflight.py`, `config.py`, `depth.py`, `backends/{base,diffusers_backend,relief_backend,mesh,mock}.py`, `tests/test_plumbing.py` (green), `requirements.txt`, `setup.sh`, `README.md`.

## 4. The schema system (touch nothing without understanding this)

Every payload carries a **`$omni3d` version tag** and routes through a Zod **discriminated union** (`src/schemas/index.ts`):
- `SCHEMAS` registry: `"pipeline.job/v1"`, `"loopA.frameSampler.out/v1"`, `"loopA.voxelDraft/v1"`, `"loopA.retopology.io/v1"`, `"loopB.rigging.skinWeights/v1"`, `"loopB.animation.retarget/v1"`, `"loopC.eitl.validation/v1"`.
- `StagePayload` = union of the six stage payloads; `OmniPayload` = those + the job envelope.
- `STAGE_CHAIN` pins the canonical ordering; each stage names its `nextStage`.

**Rules when adding any new wire surface** (asset uploads, queue events, gateway contracts, characters, scenes…):
1. Zod schema in `src/schemas/` (or a WO-designated schemas file), `.strict()` objects, versioned tag if it's a payload (`yourthing/v1`).
2. Register/export it and extend `src/export-json-schema.ts` + `npm run validate` coverage where applicable.
3. Sample payload in `docs/payloads/` if it's a job-level contract.
4. Never mutate an existing `/v1` schema's meaning — add fields as `.optional()`, or mint `/v2`.

## 5. The two core seams (where new code plugs in)

**`advanceJob(job, opts, overrides)`** (`src/loops/runner.ts`): moves a job exactly one stage along `STAGE_PLAN` (A1→A2→A3→B1→B2→C). The third arg `overrides: Partial<Record<string, StageGen>>` is the **dependency-injection seam** — keyed by stage key (`"A1"`…`"C"`), it swaps the synthetic generator for a real provider. This is how `features.realPipeline` works and how you inject anything new (engine-backed generation, character-reuse skip, audio stage). Extend `STAGE_PLAN` only with extreme care: every smoke and `LOOP_TOTALS` depends on it.

**`JobStore`** (`src/store/types.ts`) — the persistence contract:
```ts
interface JobStore {
  readonly kind: string;
  put(job) / get(id) / list(limit?)
  putStage(jobId, stage) / getStages(jobId)
  appendEvent(jobId, event): Promise<LiveEvent>   // assigns monotonic seq!
  getEvents(jobId, fromSeq?)                      // ordered replay
}
```
Both `MemoryJobStore` and `SupabaseJobStore` implement it. If your WO adds persisted entities (ledger rows, characters, scenes, keys), either extend this interface **in both implementations** or follow the same pattern with a sibling interface. `appendEvent` assigning `seq` is what makes WebSocket replay work — do not bypass it.

## 6. THE CRITICAL SEAM — procedural inputs (why WO-01/02 exist)

`buildStageContext()` in `src/loops/real-providers.ts` fabricates ALL pipeline inputs procedurally: 4 checkerboard PNGs (2 sharp, 2 blurred) as "frames", a voxel sphere's silhouettes, `icosphere(5)` (20,480 tris, watertight) as the mesh, 2 spine bones, and a synthetic 48-frame walk clip. **The real providers run real algorithms on fake inputs.** User uploads never reach the pipeline; `asset://` URIs in job payloads resolve to nothing.

So the true modernization seam is: *make `StageContext` come from real uploaded media.* WO-01 (file I/O) gives uploads a home and writes real `.glb` outputs; WO-02 (engine bridge) generates real input images/meshes. Whichever you're building, `StageContext` is the interface to feed — keep `buildStageContext()` as the zero-infra fallback (CI and no-GPU machines depend on it).

Also know: `runRealPipeline()` loops `advanceJob` to completion in-process — WO-03's worker should reuse it (or its pattern), not reimplement stage sequencing.

## 7. Live events — the wire protocol UE5/Unity and the web UI consume

`LiveEvent` (`src/live/events.ts`): strict discriminated union on `type`: `connected`, `stage.completed` (stage tag, done, status, loops), `eitl.result` (passed/score/threshold/repairs/rerunPhases), `asset.push` (engine, bundle, endpoint), `pipeline.complete`, `error`. All carry `ts`; `seq` is assigned at persist time by `appendEvent`.

`eventsForAdvance(job, emitted, done)` maps one advance → ordered events. **Extend the union for new event types** (queue position, credits spent, shot progress) — never send ad-hoc JSON on the bus. The `/live` WebSocket (in `src/app.ts`) does subscribe-first-then-replay-from-`?from=<seq>` with buffering — study it before touching; the ordering guarantee is deliberate and smoke-tested (`smoke:bus`, `smoke:live`).

Current API routes (all in `src/app.ts`): `GET /health /schemas /jobs /jobs/:id /jobs/:id/stages /jobs/:id/events`, `POST /pipeline /jobs/:id/advance (?defect=manifold|intersections|vertex_tear) /jobs/:id/stages`, `GET /live` (WS), plus `/` dashboard. "Auth" today = optional `x-omni-owner` header (defaults `user_anon`) — WO-05 replaces this; until then don't build on it beyond passing it through.

## 8. Code conventions (mirror what's there)

- Strict Zod everywhere, `safeParse` + 400-with-issues on API boundaries.
- `structuredClone` for job mutation (see `advanceJob`) — never mutate stored objects in place.
- Pure factories (`buildApp`), DI via parameters, `app.inject()` for HTTP tests — new routes must stay injectable-testable without a listening socket.
- One `smoke-<thing>.ts` per feature, self-contained, prints `✓` lines and a final `<THING> SMOKE PASS`; wired into the `check` script chain. Your WO's acceptance smoke follows this exact shape.
- Comment style: sparse, contract-level (`/** ... */` on interfaces/functions), no narration.
- Dependencies: the repo runs on 8 runtime deps. Your WO lists what you may add; anything else needs fifty-plain-lines justification in the PR.

## 9. Cross-WO integration contracts (so parallel agents don't collide)

| Contract | Owner (creates it) | Consumers (may assume it exists) |
|---|---|---|
| `AssetStore` (`src/assets/store.ts`): `put/get/stat`, `asset://` resolution, `POST /assets`, `GET /assets/*` | WO-01 | ALL later WOs |
| `engine/` HTTP service (`/health /generate/image /generate/mesh`) + `src/engine/client.ts` | WO-02 | WO-07, WO-10 (`/generate/speech`), WO-12 (`/upscale/*`) |
| Queue (`src/queue/queue.ts` + worker) + new LiveEvent types (`job:queued`… with `queuePosition`) + ledger (`src/billing/ledger.ts`, charge→refunded flip) | WO-03 | WO-04, 06, 07, 08, 11, 13, 14 |
| `web/` app structure (Vite+React, `/app` mount) | WO-04 | WO-05, 06, 08, 09, 11, 12 |
| Auth plugin (JWT/localMode, owner injection) + `projects` | WO-05 | WO-09, 13, 14 |
| Cost table (`src/billing/costs.ts`) + `POST /estimate` + `budgetCap` | WO-06 | WO-07 (adds rows), 11, 12, 14 |
| Gateway contracts (`src/gateway/contracts.ts`) + provider adapter shape (`capabilities()`, `costRows()`) | WO-07 | WO-08 (textHint), 09 (characterId conditioning), 10 (TTS adapters) |
| Camera preset schema + `presets/cameras.json` + `POST /render/camera` | WO-08 | WO-09 (reference renders), 11, 12, 13 |
| Character model (`geometryHash`!) + `/characters` | WO-09 | WO-10, 11 |
| Docker/CI/staging env + PR template + `/status` | WO-15 | ALL (CI is the merge gate), WO-16, 17 |
| `design/tokens.css` (Studio Dark, SITE_SPEC §5) | WO-16 (WO-04 stubs it if building first) | WO-04 and every UI surface |
| e2e suite + Lighthouse budgets + honesty-lint | WO-17 | every release |
| `policyVersion` on jobs + `blocked_by_policy` state | WO-18 | WO-07 gateway, ledger |

Rules: (a) if you need a contract your WO doesn't own, code against the WO file's spec and mark the ledger `BLOCKED-ON: WO-NN` rather than inventing a parallel version; (b) if you must CHANGE a contract you don't own, that's an escalation (§11); (c) additive changes to your own contract are fine — note them in the ledger.

## 10. State-preservation protocol (how nothing gets lost)

1. **[BUILD_LEDGER.md](./BUILD_LEDGER.md) is the single running memory.** Append-only per-WO entries at start, on every discovery, and at finish (format defined in the file itself). If you learned something the next agent needs — a version quirk, a changed file, a decision — it goes in the ledger, not just your PR text.
2. **PROGRESS.md** (repo root) = current focus + next action. Update it when your WO lands or hands off.
3. **One WO = one branch (`wo/NN-slug`) = one draft PR.** Small single-purpose commits with plain messages. Paste your acceptance-command outputs verbatim in the PR description.
4. **Never leave a branch un-pushed** at the end of a session — push even broken WIP with a `WIP:` commit and a ledger note saying exactly where you stopped and what's next.
5. If the repo has drifted from your WO's assumptions: update the WO file in the same PR, note it in the ledger, and say so in the PR.
6. Re-entry checklist for a fresh agent resuming a WO: read this file → the WO → the ledger (search your WO id) → `git log --oneline -15` on main and your branch → run `npm run check` → continue from the ledger's "next" line.

## 11. Escalate (stop and report) instead of pushing through when…

- Baseline `npm run check` is red before your changes.
- Your fix requires changing a contract another WO owns (§9), modifying `STAGE_PLAN` semantics, or editing an existing `/v1` schema's meaning.
- You need a secret/credential that isn't documented (`FAL_KEY`, Stripe keys, Supabase project) — request it in the PR, mock it, mark ledger `BLOCKED-ON: credentials`.
- Anything security-shaped: found secrets in code, path traversal risks beyond WO-01's guard, auth bypass.
- A dependency your WO doesn't allow seems genuinely necessary.

## 12. Known gotchas (verified, will bite you)

- Existing smokes drive the **manual advance flow** (`POST /jobs/:id/advance`); WO-03 keeps it behind `features.manualAdvance` — never delete it.
- `?defect=manifold|intersections|vertex_tear` on advance forces EITL defects — that's how repair-path smokes work.
- Jimp v1 API (`new Jimp({width,height,color})`, `img.getBuffer("image/png")`) differs from most online v0 examples.
- `meshoptimizer` (npm) is the WASM build — async init; see `src/loops/providers/retopology.ts` for the working usage.
- `docs/payloads/*.json` are GENERATED (`npm run export:schema`) — regenerate, don't hand-edit.
- The `public/` dashboard reads the same job/event APIs — breaking response shapes breaks it silently; click through `/` after API changes.
- Supabase store exists but no migration covers new tables you add — ship SQL in `supabase/migrations/` AND the in-memory twin together.
- Windows paths: use `node:path` joins everywhere; tests must not hardcode `/`-rooted paths.
- `npm run check` is the merge gate for every WO. Extending it is mandatory (your smoke), keeping it green is law.
