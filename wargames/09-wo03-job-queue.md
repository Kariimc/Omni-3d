# WARGAME 09 — Executing WO-03 (durable job queue + refund bookkeeping)

> Battle plan for a cheaper executor. **Read this whole file, then
> [../docs/plan/work-orders/WO-03-job-queue.md](../docs/plan/work-orders/WO-03-job-queue.md),
> then [../docs/plan/HANDOFF.md](../docs/plan/HANDOFF.md) §4–7 and
> [../wargames/README.md](./README.md) (carried intel), before any edit.** Written so you
> run the mission end to end without asking a question.

## Assumption fought under
The two blanks in the wargame order were left empty. **Assumption:** the mission is **build
WO-03 (durable job queue)** — the next critical-path Phase-0 item, unblocked now that WO-01
landed, and the one that already carries a live finding (the concurrency-race canary from
wargame 07). If the real brief differs, it overrides this file.

## Mission
Replace "the caller POSTs `/advance` six times" with a **durable queue + worker** that runs a
job to completion on its own, streams progress over SSE, survives a worker restart, and writes
refund bookkeeping when a stage fails. Zero-infra dev path must work (no Postgres required).

## Standing constraints (hard rules)
- Branch `wo/03-job-queue` off `plan/higgsfield-competitor`. One commit per logical fix. Draft PR. Never merge to main.
- **Bounded scope:** build the queue the mission names. Do NOT retune EITL weights, poly budgets, retry counts beyond what the spec states, or any design constant — if one looks wrong, write it in PROGRESS.md, don't change it.
- Reuse the existing `EventBus` (`src/live/bus.ts` + `src/live/factory.ts`) — **do not build a second broadcaster.**
- Keep `npm run check` green; never weaken a smoke to pass. Add `smoke:queue` and wire it in.
- Only new dep allowed: `pg-boss`.
- Log every move in `docs/plan/BUILD_LEDGER.md`; update PROGRESS.md; one relay line (see Verification §Paper trail).

---

## Recon already done for you (verified 2026-07-06 — confidence noted per fact)

- **[on-paper] The persist+publish loop lives in the HTTP handler, not a reusable function.**
  `POST /jobs/:id/advance` (`src/app.ts:78-103`) does: `advanceJob` → `store.put` → `store.putStage`
  → for each event `store.appendEvent` (assigns `seq`) → `bus.publish`. Meanwhile `runRealPipeline`
  (`src/loops/real-providers.ts:162-176`) loops `advanceJob` to completion but **persists nothing
  and publishes nothing** — it's a pure in-process driver. **Therefore the worker cannot just call
  `runRealPipeline`.** The smallest correct move (Move 3) is to extract the handler's persist+publish
  body into one shared helper both the route and the worker call — otherwise the two paths drift and
  the live stream silently diverges from the queue.
- **[on-paper] `GET /jobs/:id/events` already exists as REST JSON** (`src/app.ts:113-119`), returns
  `store.getEvents(id, from)`. The WO-03 spec wants an **SSE** stream on that same path. The `public/`
  dashboard and existing behavior may read the JSON shape. **Collision — do not silently replace it**
  (see RECON R1 + Looks-broken list).
- **[on-paper] `LiveEvent` is a `.strict()` discriminated union on `type`** (`src/live/events.ts:12-61`)
  with EXISTING types `connected`, `stage.completed`, `eitl.result`, `asset.push`, `pipeline.complete`,
  `error` — **dot-separated**. New queue events (`job.queued`, `job.failed`, `job.done`, queue position)
  MUST be added to that union or `LiveEvent.parse` throws. Match the **dot** naming, not the spec's
  `job:queued` colons (consistency; the colons are shorthand, not a contract).
- **[on-paper] Event `seq` is assigned by `store.appendEvent`** (`src/store/memory.ts:37-43`), a
  store-wide monotonic counter, bucketed per job on read (`getEvents` filters by jobId then `seq > from`).
  Verified correct in wargame 07 (NOT-A-BUG). The worker must publish events **through `appendEvent`**
  so SSE resume keeps working — never hand-broadcast un-persisted events.
- **[on-paper] The concurrency race (wargame 07 suspect #2) is structurally fixed by this WO:** one
  worker draining one job serializes advances. The `smoke:race` canary lives on branch `wargame/07-bugs`,
  NOT on the plan branch — you will not have it unless #3 (PR) merges first. Don't depend on it; note it.
- **[high] EventBus factory** (`src/live/factory.ts`) already selects memory / pg-notify / supabase from
  `EVENT_BUS`. The queue is a SEPARATE concern (work distribution) from the bus (event fan-out). Build the
  queue behind its own interface; keep using the bus for events.
- **[high] Config** (`src/config.ts`) exposes `databaseUrl`, `supabase`, `eventBus`, `port`, `host`.
  No `DIRECT_URL` yet — you add it (pg-boss needs the direct 5432 connection, NOT the pooled string).
- **[on-paper] Node 24, TypeScript+Fastify5+Zod, tsx, no build, ESM.** Tests are bespoke `smoke-*.ts`
  chained by `npm run check` (12 suites green on the plan branch). Windows dev box (Git-Bash/PowerShell).

---

## The plan, move by move

### Move 0 — Ground truth (before touching anything)
```bash
cd <repo>; git checkout plan/higgsfield-competitor && git pull
git status --short && npm install && npm run check
git checkout -b wo/03-job-queue
```
- **Expected observation:** clean tree; `npm run check` ends `PASS` with 12 green smoke suites; branch created.
- **Most likely failure:** `check` red on the plan branch.
- **Cause it signals:** environment drift, or you're not on the plan branch. That red is **Bug 0 — it outranks the mission.**
- **Counter-move:** `node --version` (≥20), reinstall, confirm branch. Do not build on red.
- **Fork — trigger:** cannot reach green in 15 min → **ABORT A1** (report, land nothing).

### Move 1 — Extract the persist+publish helper (no behavior change yet)
Pull the body of the `/advance` handler's persist+publish steps (`src/app.ts:89-94`) into one
function, e.g. `advanceAndPersist(store, bus, job, opts) → { result, events }` in
`src/loops/runner.ts` or a new `src/queue/drive.ts`. Make the existing `/advance` route call it.
- **Expected observation:** `npm run check` still green — the route behaves identically; `smoke:live`,
  `smoke:bus`, `smoke` unchanged. This is a pure refactor (behavior-preserving).
- **Most likely failure:** an existing smoke goes red.
- **Cause it signals:** you changed event ordering or the response shape, not just moved code.
- **Counter-move:** diff the emitted events/response against `main`; the helper must emit the SAME events
  in the SAME order and the route must still return the same 200 body. Revert to a literal extraction.
- **Fork — trigger:** can't extract without changing behavior → the coupling is deeper than expected →
  keep the route as-is and have the worker call a NEW helper that duplicates the 4 lines (accept the small
  duplication, note it in PROGRESS.md) rather than risk the live path. **[judgment call]** duplication of
  4 lines is acceptable; divergence of behavior is not.

### Move 2 — Queue interface + zero-infra fallback
`src/queue/queue.ts`: interface `Queue { enqueue(name, data, opts?: {priority?}) ; work(name, handler) ; status() ; stop() }`.
Two impls behind it: `SimpleQueue` (in-process FIFO, single worker, `setImmediate` drain loop — the
DEFAULT when no `DIRECT_URL`/pg configured) and a `pg-boss`-backed impl (when configured). Add
`DIRECT_URL` to `src/config.ts`.
- **Expected observation:** `npm run typecheck` clean; a throwaway probe enqueues 3 jobs and the handler
  runs them FIFO to completion; `status()` reports depth 0 after drain.
- **Most likely failure:** `SimpleQueue` runs handlers concurrently / re-entrantly and two jobs interleave.
- **Cause it signals:** the drain loop starts the next job before the current handler's promise resolves.
- **Counter-move:** the drain loop must `await` each handler before pulling the next item; a single in-flight
  slot. (This single-worker property is ALSO what structurally kills the concurrency race — keep it.)
- **Fork — trigger:** you're tempted to add worker-pool concurrency → **stop**, that's out of scope
  (spec "Out of scope: multi-worker scaling"). Single worker only.

### Move 3 — Worker drives a job to completion, emitting events
`src/queue/worker.ts`: consumes `pipeline.run {jobId}`, loads the job, loops the Move-1 helper to
completion, emitting NEW `LiveEvent`s at boundaries. **First add the new event types to the union in
`src/live/events.ts`** (`job.queued`, `job.stage.start`, `job.stage.finish`, `job.failed`, `job.done`,
each optional `queuePosition`), then emit them via `appendEvent`+`bus.publish` (through the Move-1 helper's
path so `seq` is assigned). Retries: 2 per stage with backoff, then mark the job failed.
- **Expected observation:** enqueue one job → the bus emits `job.queued` then the 6 `stage.completed`
  events then `job.done`, each with a `seq`; `store.get(jobId).status === "passed"`.
- **Most likely failure:** `LiveEvent.parse` throws `invalid_union_discriminator` when the worker emits a
  new type.
- **Cause it signals:** you emitted a `type` not added to the strict union.
- **Counter-move:** add every new variant to the `LiveEvent` union (strict object, `...withSeq`) and to
  `eventsForAdvance` if it maps from a runner advance; re-run.
- **Fork — trigger:** if a stage legitimately fails (forced defect) → the worker must emit `job.failed`
  and flip the ledger row (Move 5), NOT crash the drain loop. If you observe the whole queue stall after
  one failed job, the handler let the error escape the try/catch → wrap per-job execution.

### Move 4 — API: enqueue on POST /pipeline, SSE events, queue status
`POST /pipeline` enqueues a `pipeline.run` job and returns `202` + jobId **unless**
`features.manualAdvance` is set, in which case it keeps the OLD synchronous create-only behavior so the
existing smokes pass. Add `GET /queue/status` (depth + worker liveness). For SSE, add a NEW route
`GET /jobs/:id/stream` (SSE) — **do NOT repurpose `GET /jobs/:id/events`** (see R1 / Looks-broken).
- **Expected observation:** `POST /pipeline` (no manualAdvance) → `202`; `curl -N /jobs/:id/stream` prints
  `data: {...}` lines for each event ending in `job.done`; `GET /queue/status` → `{depth, worker:"alive"}`;
  all existing smokes (which drive `/advance`) still green because they set `features.manualAdvance` OR the
  create path still persists the job.
- **Most likely failure:** existing `smoke`/`smoke:live` go red because `POST /pipeline` no longer returns
  the full job body / no longer leaves the job advanceable by hand.
- **Cause it signals:** you changed the create contract those smokes rely on.
- **Counter-move:** gate the new enqueue behavior behind `features.manualAdvance === false` (default), and
  set `manualAdvance: true` in the existing smokes' request payloads (that's a test-input change, allowed —
  you're not weakening assertions). Confirm `DEFAULT_FEATURES` in `src/schemas/request.ts` — add
  `manualAdvance` there with a default that keeps CI green (see R2).
- **Fork — trigger:** SSE stream shows nothing in `curl -N` → the response likely buffered → set
  `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, flush per event,
  and send a `:heartbeat\n\n` comment every ~15s. Verify with `curl -N` (not a JSON client).

### Move 5 — Refund bookkeeping ledger
`src/billing/ledger.ts`: Zod schema `Charge { jobId, estimatedCredits, status: "charged"|"refunded" }`,
stored via the existing store layer (extend `JobStore` in BOTH `memory.ts` and `supabase.ts`, or a sibling
interface following the same pattern). Worker writes `charged` on job start; on `job.failed` flips to
`refunded` automatically. (No payments — bookkeeping only.)
- **Expected observation:** a job with a forced-fail stage ends with its ledger row `status === "refunded"`;
  a passing job stays `charged`.
- **Most likely failure:** the flip races the failure event, or a failed job leaves the row `charged`.
- **Cause it signals:** the refund write isn't in the same code path that emits `job.failed`.
- **Counter-move:** write the refund flip in the worker's catch/fail branch, immediately before/after
  emitting `job.failed`, in the same await sequence.
- **Fork — trigger:** if extending `JobStore` ripples into many callers → add a small sibling
  `LedgerStore` interface instead (same in-memory + pg pattern) and keep `JobStore` untouched.
  **[judgment call]** prefer the sibling if the diff to `JobStore` callers exceeds ~5 sites.

### Move 6 — Durability + graceful shutdown
Graceful stop: worker finishes the current stage, re-queues the job. Durability test lives IN `smoke:queue`
(Move 7), not manual.
- **Expected observation:** stopping the worker mid-job then restarting it completes the job exactly once
  (6 distinct stages, no duplicate, no skip).
- **Most likely failure:** on restart the job re-runs from stage 0 (duplicate stages) OR resumes but
  double-emits the stage it was on.
- **Cause it signals:** the worker doesn't checkpoint `runner.cursor` to the store between stages, or it
  re-enqueues without dedup.
- **Counter-move:** persist the job (with its advanced `runner.cursor`) after EVERY stage (the Move-1 helper
  already does `store.put`); on resume, `advanceJob` continues from the stored cursor. Idempotency = the
  cursor in the store.
- **Fork — trigger:** SimpleQueue (in-process) loses its queue on restart by nature → for the SimpleQueue
  path, "restart" = re-enqueue the in-flight jobId from the store's non-terminal jobs on boot; document that
  pg-boss gets true durability and SimpleQueue gets best-effort resume. **[judgment call]** that asymmetry
  is acceptable and must be stated in PROGRESS.md.

### Move 7 — `smoke:queue` (enqueue → SSE → done, + durability + refund) and wire into check
`src/smoke-queue.ts`: (1) real `app.listen(0)`; (2) enqueue a job; (3) consume `/jobs/:id/stream` via a
raw HTTP client, assert 6 stage events + `job.done` in order; (4) **durability:** programmatically stop the
worker after stage 2, restart, assert completion with exactly 6 distinct stages; (5) **refund:** a
forced-defect job → assert ledger row `refunded`. Add `"smoke:queue"` and append to the `check` chain.
- **Expected observation:** `npm run smoke:queue` prints `✓` lines + `QUEUE SMOKE PASS`; `npm run check`
  still `PASS`.
- **Most likely failure:** the SSE assertion hangs (never sees `job.done`) or the durability restart flakes.
- **Cause it signals:** SSE not flushing, or the stop/restart used a fixed sleep instead of awaiting a state.
- **Counter-move:** await a terminal event/state with a timeout, never `sleep(n)`; parse `data:` lines
  incrementally. (Carried gotcha from wargame 07: for ws/stream clients attach the listener BEFORE the
  stream opens or you lose the first frames.)
- **Fork — trigger:** durability sub-test is irreducibly flaky on SimpleQueue → mark THAT sub-assertion
  `MANUAL-PENDING` in the smoke output and the ledger, keep the rest green, and prove durability on the
  pg-boss path if `DIRECT_URL` is available (R3). Do not delete the sub-test.

---

## RECON NEEDED — settle before acting

| # | Assumption | Exact check | What each outcome means |
|---|---|---|---|
| R1 | `GET /jobs/:id/events` JSON is consumed by the dashboard/smokes | `grep -rn "jobs/.*events\|/events" public/ src/*.ts` | If consumed → **keep it**, add SSE on the new `/jobs/:id/stream` path (plan assumes this). If unused → you MAY convert `/events` to SSE, but the new path is still safer. |
| R2 | `features.manualAdvance` doesn't already exist / how to default it | read `src/schemas/job.ts` Features + `src/schemas/request.ts` DEFAULT_FEATURES | If absent → add it. Default it so existing smokes stay green with the SMALLEST test-payload change (set `manualAdvance:true` in those smokes). |
| R3 | pg-boss path is testable here | is `DIRECT_URL` set in env? `echo "$DIRECT_URL"` | Set → run the pg-boss durability test for real. Unset → SimpleQueue only; mark pg-boss path `MANUAL-PENDING`, do NOT claim it verified. |
| R4 | `JobStore` extension vs sibling ledger store | `grep -rn "implements JobStore\|: JobStore" src/` | ≤2 impls (memory, supabase) → extend both. If extending ripples into many call sites → sibling `LedgerStore` (Move 5 fork). |
| R5 | pg-boss v10+ API (`boss.work`/`boss.send`) matches what you write | after install: `node -e "const P=require('pg-boss'); console.log(typeof P)"` + skim its README | API drift → adjust; if it can't init without a live DB, keep it lazy-imported (like `factory.ts` does for `pg`) so CI never needs Postgres. |

---

## Looks broken but isn't — do NOT "fix" these

- **[on-paper] Store-wide `seq` counter** (`memory.ts`) — looks like it should be per-job; it's correct
  (bucketed on read). Proven NOT-A-BUG in wargame 07. Leave it.
- **[on-paper] `runRealPipeline` persists nothing** — that's by design (it's a demo driver, not the server
  path). Don't "add persistence" to it; the worker uses the Move-1 helper instead.
- **[on-paper] `/advance` stays after this WO** — the manual advance path is deliberately kept behind
  `features.manualAdvance` for the existing smokes. Do NOT delete it.
- **[on-paper] `engine:"both"` collapses to `ue5` in the EITL label** — cosmetic, both export blocks kept.
  NOT this WO's concern. Leave it.
- **[on-paper] `public/` dashboard at `/`** — untouched by WO-03. If your SSE work makes `/` break, you
  changed a shared response shape — revert, use the new `/stream` path.
- **[high] The EITL weights / retry-count "2 per stage" / poly budgets** — design constants. If one looks
  wrong, PROGRESS.md, not a code change.

---

## Abort conditions (stop, revert surgically, report)

- **A1:** Move 0 baseline can't go green — report, land nothing.
- **A2:** A change forces editing/deleting an existing smoke's ASSERTIONS to stay green (changing a test
  INPUT like `manualAdvance:true` is fine; weakening an assertion is not) → escalate, it's a spec question.
- **A3:** You cannot verify the queue at runtime at all (SSE won't stream, worker won't run in this env) →
  **land nothing as "verified."** Commit the code with every claim labeled **MANUAL-PENDING** in the PR and
  ledger, say so plainly, stop.
- **A4:** pg-boss needs a live DB you don't have AND the SimpleQueue path can't satisfy the durability test
  → SimpleQueue best-effort + pg-boss `MANUAL-PENDING`; do not fake durability.
- **A5:** Time/budget cap → commit what's green with its smoke, ledger the proven-vs-open split, push WIP, stop.

---

## Verification runs (last section) — each with its PASS definition

Run in order:
1. `npm run typecheck` — **PASS =** no errors; no new `as any`/`@ts-ignore` in `src/queue`, `src/billing`
   (grep-diff to confirm).
2. `npm run check` — **PASS =** ends `PASS`; all pre-existing smokes ✓ **and** `QUEUE SMOKE PASS`.
3. `npm run smoke:queue` alone — **PASS =** enqueue→SSE shows 6 stage events + `job.done` in order;
   durability restart completes with exactly 6 distinct stages; forced-fail job → ledger `refunded`.
   (Any sub-assertion you couldn't run → printed `MANUAL-PENDING`, not silently skipped.)
4. `npm run pipeline:real` — **PASS =** `status: passed`, 6 stages, EITL repairs 0 (behavior unchanged —
   the queue must not alter pipeline output).
5. Revert-red proof for the refund gate: temporarily make the worker NOT flip the row on failure →
   `smoke:queue` refund sub-test FAILS; restore → PASSES. Paste both. (The gate must actually guard.)

### Paper trail (do this, don't skip)
- One branch `wo/03-job-queue`; one commit per logical fix (helper extract / queue / worker / API / ledger / smoke).
- Draft PR based on `plan/higgsfield-competitor`, acceptance output pasted, "what ran REAL vs MANUAL-PENDING" section.
- `docs/plan/BUILD_LEDGER.md`: append a `[WO-03]` entry (verdicts + discoveries + carried gotchas) and flip the status-board row.
- `PROGRESS.md`: update the next-action line.
- Relay: if a relay system exists (`relay/log.md` or the `relay` skill), add one line: `WO-03 <status> — <next step>`. If none exists, the BUILD_LEDGER entry IS the relay line — note that so the next agent knows where to look.

### Three-line report (print at the end of the run)
```
Assumption fought under: <one line>
Findings by confidence: <N on-paper> / <N high> / <N judgment>  — bugs found: <N>, fixed: <N>, MANUAL-PENDING: <N>
Single next step: <the one thing to do next>
```

---

## After the run — SCORING (the wargame isn't done until this happens)
1. Compare the executor's report move-by-move against each **expected observation** above; write the deltas
   (where reality diverged from this plan) into the front matter of the next wargame (10-*).
2. Land the results in `PROGRESS.md` and the relay line.
3. Cold re-run of the Verification block days later (fresh clone, `npm ci && npm run check && npm run smoke:queue`)
   to catch rot. If it's no longer green, that regression is Bug 0 for the next session.
