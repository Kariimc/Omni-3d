# Wargames — index & carried intel

> Battle plans written by a planning agent for a cheaper executor to run. Each is
> self-contained (runs without questions). **This index also carries the reusable intel
> the wargames surfaced, so a new agent inherits the findings without re-reading every
> move.** If you build or debug anything in `src/`, read the relevant wargame first.

## The wargames

| # | File | Mission | Branch the executor uses | Status |
|---|------|---------|--------------------------|--------|
| 07 | [07-bugs.md](./07-bugs.md) | Find, prove, fix real pipeline defects without breaking green | `wargame/07-bugs` | **RUN** → PR #3 (1 real defect fixed: silent `/live` replay failure) |
| 08 | [08-wo01-file-io.md](./08-wo01-file-io.md) | Build WO-01 (real file I/O — uploads + real `.glb` download) | `wo/01-real-file-io` | **RUN** → PR #4 (green; glb validates clean) |
| 09 | [09-wo03-job-queue.md](./09-wo03-job-queue.md) | Build WO-03 (durable queue + worker + refund ledger) | `wo/03-job-queue` | written, not yet run |

07 and 08 have been executed (draft PRs #3, #4, both on the plan branch). 09 is the next to run.

## Carried intel — verified repo facts the wargames established (don't re-derive)

**Baseline & tooling**
- Green baseline: `npm install && npm run check` = typecheck + `validate` + **11 smokes**; `npm run pipeline:real` → `status: passed`. A red baseline invalidates everything downstream — fix it before any work (wargame 07 Move 0 is the drill).
- No unit-test framework. Tests are bespoke `src/smoke-*.ts` scripts chained by `npm run check`. Every new feature adds its own `smoke:<name>` and wires it into the chain. Never weaken a smoke to pass.
- Node ≥20 (24 present). TypeScript + Fastify 5 + Zod, run via `tsx`, **no build step**. `"type": "module"` (ESM).
- Windows dev box (Git Bash/PowerShell). Use `node:path`; never hardcode `/`-rooted paths. CRLF warnings are harmless.

**Core flow & seams**
- `POST /pipeline` → `buildJobEnvelope` (`src/schemas/request.ts`) → `POST /jobs/:id/advance` → `advanceJob` (`src/loops/runner.ts`) runs one `STAGE_PLAN` stage A1→A2→A3→B1→B2→C → persists stage + appends/publishes `LiveEvent`s → `/live` WebSocket replays from store then streams.
- **The DI seam:** `advanceJob(job, opts, overrides)` — the 3rd arg swaps synthetic generators for real providers per stage key (`"A1"`…`"C"`). Where new stage logic plugs in; `features.realPipeline` uses it.
- **The factory seam:** `buildApp(store, bus)` (`src/app.ts`) is a pure factory (tests use `app.inject()`). New routes/dependencies go through it — add new params as **optional-with-default** so existing callers keep compiling (`grep -rn "buildApp(" src/` before changing the signature).
- The mesh serialized to `.glb` already exists: `interface Mesh { positions: Float32Array; indices: Uint32Array }` (`src/loops/providers/retopology.ts:5-8`); real pipeline builds `icosphere(5)` in `buildStageContext()` (`src/loops/real-providers.ts`).

**Scaffold boundary (NOT bugs — documented as intentional; don't "fix")**
- Artifacts are `asset://<jobId>/…` manifest URI **strings** (`src/schemas/request.ts:74-82`), not files on disk.
- "Real" providers run real algorithms on **procedurally generated inputs** (`buildStageContext()`), so uploaded media never reaches the pipeline. WO-01/WO-02 close this seam.
- `public/` serves a live dashboard at `/` — don't break it.

**Bug-hunt suspects (wargame 07) — status: hypotheses, not yet confirmed**
1. Concurrent `POST /jobs/:id/advance` on one job — read-`cursor`/write-`cursor+1` across `await` with no lock in `MemoryJobStore` → suspected lost-update/duplicate-stage race. **Highest impact.** Caveat: may be theoretical on the single-thread in-memory store; likely bites the Supabase store (real network awaits). Settle per wargame 07 Move 3 / R1–R2.
2. Store-wide `seq` counter (`memory.ts:11,38`) — recon reads it as **unusual but correct** (events bucketed per job before the seq filter); likely NOT-A-BUG, arbiter test in 07 Move 4.
3. `/live` replay→live seam (`app.ts:140-177`) — dedupe by `seq > lastSent`; probe for a duplicate/drop at the handoff (07 Move 5).
4. `list()` orders by `createdAt` string only (`memory.ts:21-25`) — same-ms ties → nondeterministic order; minor.
5. `genEitl` collapses `engine:"both"` → `"ue5"` (`generators.ts:258`) — cosmetic (both `export` blocks retained); likely NOT-A-BUG.

**WO-01 build outcomes (wargame 08 — RAN, all confirmed)**
- `@fastify/multipart` is **v10** (wargame guessed v9) — imports clean under Fastify 5. `@gltf-transform/core` writes a validator-clean GLB from Float32 positions + Uint32 indices with **no min/max needed**; the hand-rolled fallback was NOT required.
- Serialized A3/C mesh as a **side effect** — `smoke:retopo`/`smoke:e2e` stayed green (payloads unchanged). This pattern works; reuse it.
- Traversal guard in the store (resolve + `startsWith`) — the `smoke:assets` negatives all pass.
- **Windows curl gotcha:** `curl -F file=@/tmp/x` fails with error 26 (Win `curl.exe` can't read MSYS `/tmp` paths) → looks like HTTP 000 / a server crash but is client-side. Use a **repo-relative** file path for manual curl tests.

**WO-03 build intel (wargame 09) — read before building the queue**
- **[on-paper] The persist+publish loop lives in the `/advance` HTTP handler** (`app.ts:89-94`), NOT in `runRealPipeline` (which persists nothing). The worker must call a shared extracted helper, not `runRealPipeline`, or the queue and live stream diverge.
- **[on-paper] `GET /jobs/:id/events` already exists as REST JSON** — don't repurpose it for SSE; add `/jobs/:id/stream`.
- **[on-paper] `LiveEvent` is a strict union with DOT-separated types** — new queue events must be added to the union (use dots: `job.done`, not `job:done`) or `LiveEvent.parse` throws.
- **[on-paper] The single-worker queue structurally kills the wargame-07 concurrency race** — keep one in-flight slot; don't add a worker pool (out of scope).
- pg-boss needs the **direct** Postgres connection (`DIRECT_URL`, 5432), not the pooled string; lazy-import it (like `factory.ts` does for `pg`) so CI needs no DB.

## How to run a wargame (for the executor)

1. Read this index, then the specific wargame file top-to-bottom.
2. Branch as the file specifies; append a `STARTED` entry to `docs/plan/BUILD_LEDGER.md`.
3. Execute move by move — each move's "expected observation" is your checkpoint; on a miss, take the stated counter-move or fork.
4. Anything marked **RECON NEEDED**: run its settling check before acting.
5. Honor the abort conditions; run the final verification list; log the verdict (FIXED / NOT-A-BUG / RECON-NEEDED / ABORTED / LANDED) in the ledger.

## Writing the next wargame

Number sequentially (`09-*.md`). One mission per file. Every move: expected observation, most-likely failure → cause → counter-move. Every fork: a trigger ("if you observe X, take route B"). Unsettled assumptions → RECON NEEDED with the exact check. End with abort conditions + verification runs with per-run pass criteria. Add a row to the table above and a line to the carried-intel section if it surfaces a durable fact.
