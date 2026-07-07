# WARGAME 07 — Bug hunt on the Omni3D pipeline

> Battle plan for a cheaper executor (Claude Code, cheaper model). **Read this whole file
> before touching the repo.** It is written so you can run the mission end to end without
> asking a question. Every move tells you what you should see, what most likely goes wrong,
> and where to go next.

## Mission

Find, **prove**, and fix real defects in the Omni3D closed-loop pipeline (`src/`) **without
breaking the green baseline** and without changing pipeline behavior the smokes rely on.
"Real defect" = code that produces a wrong result, loses/corrupts data, races, or crashes
under an input the product will actually see. Scaffold gaps that are *documented as
intentional* (no real file I/O, procedural inputs) are NOT bugs — ignore them.

Deliverable: one PR per confirmed bug (or one PR grouping trivial fixes), each with a
failing check first, then the fix, then the check passing. Log every move in
`docs/plan/BUILD_LEDGER.md`.

### Guardrails (hard rules)
- **Read-only until Move 3.** Recon before any edit.
- Never weaken or delete a smoke to make it pass. `npm run check` must stay green.
- Smallest change that fixes the proven defect. No refactors, no new deps.
- One branch `wargame/07-bugs` off the current branch; small commits; draft PR; do not merge to main.
- If a "bug" turns out to be by-design (check the docs/comment), record it as NOT-A-BUG in the ledger and move on — do not "fix" it.

---

## Recon already done for you (verified 2026-07-06, don't re-derive)

- **Stack:** TypeScript, Fastify 5, Zod, `tsx` (no build). Node 24 present; repo targets Node 20+.
  **No unit-test framework** — tests are bespoke `tsx` scripts named `src/smoke-*.ts`, chained by `npm run check`.
- **Baseline is green** as of the last plan commit: `npm install` then `npm run check` = typecheck + `validate` + 11 smokes pass; `npm run pipeline:real` → `status: passed`.
- **Core flow:** `POST /pipeline` → `buildJobEnvelope` (`src/schemas/request.ts`) persists a job → `POST /jobs/:id/advance` calls `advanceJob` (`src/loops/runner.ts`) once per stage over `STAGE_PLAN` A1→A2→A3→B1→B2→C → each advance persists the stage, appends `LiveEvent`s (`src/live/events.ts`) to the store, and publishes them on the `EventBus` (`src/live/bus.ts`) → `/live` WebSocket replays from the store then streams live.
- **Store:** `MemoryJobStore` (`src/store/memory.ts`) default; `SupabaseJobStore` when env set. `appendEvent` assigns a monotonic `seq`.
- **The `advance` flow is driven sequentially** by the driver/smokes — nothing in the code serializes two concurrent advances of the same job.

### Prime suspects recon flagged (your hunting list — each has a move below)
1. `MemoryJobStore.seq` is a **single store-wide counter**, not per-job (`src/store/memory.ts:11,38`). Question: does `?from=<seq>` resume stay correct across multiple jobs?
2. **Concurrent `POST /jobs/:id/advance`** on one job: `advanceJob` reads `cursor` from the job, computes `next = cursor+1`, writes back. No lock in `MemoryJobStore`. Suspected lost-update / duplicate-stage race (`src/app.ts:78-103`, `src/loops/runner.ts:51-83`).
3. `/live` replay-then-live handoff (`src/app.ts:140-177`): subscribe → buffer → replay from store → flush buffer, deduped by `seq > lastSent`. Suspected edge: event landing exactly during handoff, or `from` beyond current seq.
4. `list()` orders by `createdAt` string (`src/store/memory.ts:21-25`); `createdAt` is ms-precision ISO — ties possible → nondeterministic order.
5. `genEitl` collapses `engine: "both"` → `"ue5"` (`src/loops/generators.ts:258`), dropping Unity liveSync in the emitted payload. By-design or data loss?

---

## The plan, move by move

### Move 0 — Establish the known-good baseline
Run:
```bash
npm install
npm run check
npm run pipeline:real
```
- **Expected observation:** install completes (warns about `allow-scripts` — ignore); `npm run check` ends `PASS` with every `✓`/`SMOKE PASS` line; `pipeline:real` prints `status: passed | stages: 6` (or the e2e `✓ real run: 6 real stages → status passed`).
- **Most likely failure:** `npm run check` is already red.
  - **Cause it signals:** environment drift (Node/tsx), or the branch you're on isn't the plan branch, or an earlier half-finished WO left uncommitted breakage.
  - **Counter-move:** `git status` (stash unrelated changes), `git log --oneline -3` (confirm you're on `plan/higgsfield-competitor` at the plan commits), `node --version` (expect ≥20). Get to green **before hunting** — a red baseline makes every later observation meaningless.
- **Fork — trigger:** if baseline cannot be made green in 15 min → **ABORT** (see Abort conditions), report the exact failing line.

### Move 1 — Branch and instrument (still no product edits)
```bash
git checkout -b wargame/07-bugs
```
- **Expected observation:** new branch created off the green baseline.
- **Most likely failure:** "a branch named wargame/07-bugs already exists" → a prior run started. **Counter-move:** `git branch -D wargame/07-bugs` only after confirming it has no un-pushed commits you need (`git log wargame/07-bugs --oneline`); else check it out and read the ledger for where the prior run stopped.

### Move 2 — Recon read of the five suspects
Open and read fully: `src/store/memory.ts`, `src/loops/runner.ts`, `src/app.ts` (routes + `/live`), `src/live/events.ts`, `src/live/bus.ts`. For each suspect, write a one-line "expected correct behavior" in the ledger before you test it — so your probe has a definition of "wrong."
- **Expected observation:** you can state, per suspect, the exact input that would expose the defect.
- **Most likely failure:** a suspect is actually guarded somewhere you didn't read (e.g. the driver serializes advances). **Cause it signals:** the "bug" is unreachable in practice. **Counter-move:** mark it **RECON NEEDED** with the settling check (below) rather than guessing; a defect you can't trigger isn't a defect to fix yet.

### Move 3 — Probe suspect #2 first (concurrency race — highest impact)
Write a throwaway probe `src/smoke-race.ts` (delete before final PR unless it becomes the regression test) that builds the app with a `MemoryJobStore`, creates one job, then fires **two** `app.inject({method:'POST', url:'/jobs/:id/advance'})` for that job *concurrently* (`Promise.all`), repeated ~20× advancing to completion, and asserts the job ends with exactly 6 distinct stages emitted in canonical order and `runner.cursor === 5`.
- **Expected observation IF THE CODE IS CORRECT:** every run yields exactly 6 stages, no duplicates, `cursor` monotonic 0→5.
- **Expected observation IF THE BUG IS REAL:** at least one run shows a duplicated stage tag, a skipped stage, `cursor` that jumped or repeated, or two events with the same stage — because both concurrent handlers read the same `cursor` and both wrote `cursor+1`.
- **Most likely failure of the probe itself:** `app.inject` calls resolve in series inside one process so the race never interleaves at an `await` boundary → probe always green even though a real HTTP server would race.
  - **Cause it signals:** you proved nothing, not that the code is safe.
  - **Counter-move:** confirm whether `advanceJob` + store `put` cross an `await` between the read of `cursor` and the write (it does: `store.get` is async, `advanceJob` is async, `store.put` is async). If `inject` still won't interleave, escalate the probe to a real `app.listen(0)` + two parallel `fetch()` calls. If it STILL can't interleave under Node's single-thread model for this code path, the race is **theoretical for the in-memory store** → downgrade to RECON NEEDED and note that the Supabase store (real network awaits) is where it bites.
- **Fork — trigger:**
  - Observed duplicate/skipped stage → **route FIX-A** (Move 6, add a per-job advance guard).
  - Probe stays green even as a real server → **route to suspect #1** (Move 4); log #2 as "not reproducible on MemoryJobStore, flag for Supabase store in WO-03" and move on.

### Move 4 — Probe suspect #1 (store-wide seq vs per-job resume)
Probe: create **two** jobs A and B in one `MemoryJobStore`; advance A once, B once, A once, B once (interleaved), so their event `seq` values interleave globally. Then call `getEvents(A, fromSeq)` with `fromSeq` = the seq of A's first event, and assert you get **only A's later events**, none of B's, in order.
- **Expected observation IF CORRECT:** `getEvents` filters by `jobId` map first, then `seq`, so cross-job leakage is impossible; you get exactly A's tail. (Recon reading of `memory.ts:45-47` says this is correct — the global seq is unusual but not wrong because events are bucketed per job.)
- **Expected observation IF BUG:** B's events appear in A's resume, or A's events are missed because a global `fromSeq` skipped past them.
- **Most likely failure:** you conclude "global counter = bug" on smell alone. **Cause:** confirmation bias. **Counter-move:** the test above is the arbiter — if it's green, this is **NOT-A-BUG** (unusual but correct); record that verdict and stop poking it.
- **Fork — trigger:** green → suspect #1 is NOT-A-BUG, go to Move 5. Red → **route FIX-B** (make `seq` per-job or fix the filter, whichever the failing assertion points to).

### Move 5 — Probe suspects #3, #4, #5 (lower impact, batch them)
- **#3 `/live` handoff:** start a real server (`app.listen(0)`), open a `/live?jobId=X` socket, and *while connected* advance the job to completion; assert the client receives every stage event **exactly once, in order**, with no gap and no duplicate. Then reconnect with `?from=<lastSeq>` and assert you get only newer events.
  - **Expected IF CORRECT:** exactly-once, ordered, resumable.
  - **Expected IF BUG:** a duplicated event at the replay→live seam, or a dropped event that arrived during the buffer flush.
  - **Likely probe failure:** timing flake (socket closes before last event). **Counter-move:** await a terminal `pipeline.complete` event with a timeout, not a fixed sleep.
- **#4 `list()` ordering:** create ≥3 jobs in a tight loop (same ms), call `list()`, assert a **stable, documented** order. If order is by `createdAt` only and ties are possible, that's a **minor determinism bug**.
  - **Expected IF CORRECT:** deterministic order (e.g. tiebreak on jobId).
  - **Expected IF BUG:** order varies run to run for same-ms jobs.
- **#5 `engine: "both"`:** build a job with `targets.engine: "both"`, run `genEitl`, inspect the emitted payload's `liveSync.engine` and `export`.
  - **Expected IF BY-DESIGN:** comment/schema says C targets one engine; `export` still carries both `ue5` and `unity` blocks (it does, per `generators.ts:286-289`) → the collapse is cosmetic, **NOT-A-BUG**.
  - **Expected IF BUG:** the Unity target is actually dropped from downstream artifacts, not just the `liveSync.engine` label.
- **Fork — trigger:** any of #3/#4/#5 red → open a fix (Move 6). All green/by-design → record verdicts, proceed to Move 7 (broaden the net).

### Move 6 — Fix a confirmed bug (repeat per confirmed defect)
For each confirmed defect: (a) turn the probe into a **permanent regression smoke** `src/smoke-<name>.ts` that fails on the current code; (b) apply the smallest fix; (c) wire the new smoke into the `check` chain in `package.json`; (d) `npm run check` → green.
- **FIX-A (concurrency):** serialize advances per job — a small per-jobId async mutex/promise-chain in the `/advance` route (or an optimistic `expectedCursor` check that 409s on mismatch). Prefer the 409 guard: it's smaller and needs no new state. Expected: concurrent advances now yield one winner + one 409, never a duplicate stage.
- **FIX-B (seq/resume):** make the failing assertion pass with the minimal change the test dictates (per-job seq, or corrected filter). Don't redesign the event log.
- **FIX-#4:** add a `jobId` (or `createdAt` then `jobId`) tiebreak to `list()`'s sort.
- **Expected observation:** the new smoke goes red → your fix → green; **all pre-existing smokes still green**.
- **Most likely failure:** your fix changes an observable the existing smokes assert (event order, payload shape). **Cause:** you altered behavior beyond the bug. **Counter-move:** revert, narrow the fix to only the defective path; if the smoke that breaks is asserting the *buggy* behavior, that's a **RECON NEEDED / escalate** — the "bug" may be intended; confirm against docs before overriding a smoke (never just edit the smoke to pass).

### Move 7 — Broaden the net (only if Moves 3–6 leave time/budget)
Sweep for a second tier of defects with cheap checks:
- `grep -rn "as LiveEvent\|as unknown as\|@ts-" src/` — every type assertion is a place the compiler was overridden; read each, confirm the runtime value truly matches.
- `grep -rn "catch" src/` — find swallowed errors (empty catch, catch that returns success). The `/live` replay has a `try/catch {}` (`app.ts:170-174`) that silently drops replay errors — assess whether a store failure should be visible.
- Numeric/rounding: `r6()` rounding in `runner.ts`/`generators.ts` — check no progress value can exceed 1.0 or go negative for any `polyBudget`/loop combination.
- **Expected observation:** either a new concrete defect (→ Move 6) or a clean sweep (→ document "no further defects found in scope").
- **Fork — trigger:** find something ambiguous → **RECON NEEDED**, don't fix on suspicion.

---

## RECON NEEDED — assumptions to settle before acting on them

| # | Unsettled assumption | Exact check that settles it |
|---|---|---|
| R1 | The concurrency race (#2) is reachable in the running product, not just theoretically | Run FIX-A's probe against a real `app.listen(0)` server with two parallel `fetch()` advances (Move 3). Reachable ⇔ a duplicate/skipped stage appears in ≥1 of 20 runs. |
| R2 | No hidden serialization already prevents the race | `grep -rn "advance" src/` + read the driver `scripts/omni3d_drive.sh` / `src/pipeline-real.ts`: if every caller awaits each advance before the next, the race needs a *concurrent external* caller to bite — note that scope. |
| R3 | `?from=<seq>` semantics are "strictly greater than" everywhere | Confirm `getEvents` uses `> fromSeq` (memory.ts:46 does) AND the `/live` `send()` uses `> lastSent` (app.ts:157-161 does). If either used `>=`, resume would drop/duplicate the boundary event. |
| R4 | The Supabase store shares the same contract/bugs | Read `src/store/supabase.ts`: does its `appendEvent` assign seq the same way, and does it serialize? If the mission targets only MemoryJobStore, say so and scope out Supabase. |
| R5 | A fix won't break `pipeline:real` or the live smokes | After any fix: `npm run check && npm run pipeline:real` both green (this is also the final gate). |

---

## Abort conditions

Stop and report (don't push a half-fix) if any hold:
- **A1:** Baseline `npm run check` cannot be made green (Move 0) — nothing downstream is trustworthy.
- **A2:** A "fix" forces you to edit or delete an existing smoke to keep `check` green, and you cannot confirm from docs/comments that the smoke asserts buggy (not intended) behavior. Escalate — this is a spec question for the owner.
- **A3:** The only way to reproduce a suspected bug requires changing more than the defective function (a redesign) — log it as a finding for a WO, don't attempt it here.
- **A4:** You'd need a credential/service (Supabase, network) that isn't available to prove or fix a defect — scope it to MemoryJobStore, note the gap.
- **A5:** Time/budget cap reached — commit confirmed fixes + regression smokes that are green, write the ledger with exactly what's proven vs open, push WIP, stop.

## Verification runs the executor MUST perform (definition of done)

Run in order; each must pass before the PR is marked ready:

1. `npm run check`
   - **Pass =** ends with `PASS`; every prior smoke ✓; **every new regression smoke you added ✓**; zero red lines.
2. `npm run pipeline:real`
   - **Pass =** `status: passed`, 6 stages, EITL `E=0` (unchanged from baseline — your fixes must not alter pipeline output).
3. `npx tsc --noEmit` (i.e. `npm run typecheck`)
   - **Pass =** no type errors; no new `as`/`@ts-ignore` introduced by your fix (grep-diff to confirm).
4. For each confirmed bug: `git stash` your fix, run its regression smoke → **it must FAIL** (proving the smoke actually catches the bug); `git stash pop`, run it → **PASS**. Paste both outputs in the PR.
5. Ledger check: `docs/plan/BUILD_LEDGER.md` has one entry per suspect with a verdict (FIXED / NOT-A-BUG / RECON-NEEDED / ABORTED-Ax), each citing the file:line and the check that decided it.

**PR is ready only when 1–5 all pass.** If a suspect ended NOT-A-BUG or RECON-NEEDED, that is a valid, complete outcome — the mission is to find the truth, not to manufacture fixes.
