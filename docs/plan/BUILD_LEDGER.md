# BUILD LEDGER — append-only running memory of the build

> Every builder agent appends here. Never rewrite or delete old entries (fix errors by
> appending a correction). Newest entries at the BOTTOM. This file is how knowledge
> survives agent and session boundaries — when in doubt, write it down.

## Entry format (copy this)

```
### [WO-NN] <short title> — <STATUS> — <date>
- Agent/session: <who or which session>
- Branch/PR: wo/NN-slug · <PR url or "not opened yet">
- Done: <what is actually built & verified — cite the command + result>
- Next: <the exact next action if unfinished>
- BLOCKED-ON: <WO-NN / credentials / owner decision — omit if not blocked>
```
STATUS ∈ `STARTED | WIP | BLOCKED | IN-REVIEW | LANDED | CORRECTION`

## WO status board (edit this table in place — the one exception to append-only)

| WO | Status | Branch | PR |
|----|--------|--------|----|
| 01 real file I/O | LANDED (→ main) | wo/01-real-file-io | PR #4 (merged) |
| 02 engine bridge | not started (no wargame yet) | — | — |
| 03 job queue | not started — wargame 09 ready to run | — | — |
| 04 web workspace | not started | — | — |
| 05 auth + projects | not started | — | — |
| 06 cost meter | not started | — | — |
| 07 model gateway | not started | — | — |
| 08 camera presets | not started | — | — |
| 09 character anchor | not started | — | — |
| 10 audio + lipsync | not started | — | — |
| 11 timeline editor | not started | — | — |
| 12 4K output | not started | — | — |
| 13 pro export + API | not started | — | — |
| 14 honest billing | not started | — | — |
| 15 deploy + ops | not started | — | — |
| 16 marketing site | not started | — | — |
| 17 quality gate | not started | — | — |
| 18 safety + legal | not started | — | — |

---

### [PLAN] Plan + handoff authored — LANDED — 2026-07-05
- Agent/session: planning session (Claude, with two deep-research subagents on Higgsfield)
- Branch/PR: plan/higgsfield-competitor · https://github.com/Kariimc/Omni-3d/pull/2 (draft)
- Done: research (RESEARCH_HIGGSFIELD.md), strategy (MASTER_PLAN.md), 14 work orders,
  `npm install` + `npm run check` → all 11 smokes pass; `pipeline:real` → status passed
  (A1 kept 2/4 frames | A2 3415 voxels | A3 20480→10000 tris | C E=0).
- Discovered:
  - `public/` already serves a live dashboard at `/` — earlier plan text saying "no UI"
  - The "real pipeline" runs real algorithms on PROCEDURAL inputs — `buildStageContext()`
    in `src/loops/real-providers.ts` fabricates frames/mesh/motion. Uploaded media never
  - Python engine lives OUTSIDE this repo at `~/.claude/skills/omni3d/engine/` on the
    owner's machine — WO-02 copies it in. If building WO-02 from a different machine,
    ask the owner for that folder or pull it from the omni3d skill.
  - `advanceJob`'s third arg (per-stage overrides) is the DI seam everything plugs into.
- Next: start WO-01 (real file I/O). WO-02 and WO-03 may start in parallel after WO-01's
  AssetStore interface merges (or code against its spec and rebase).

### [WARGAME-09] WO-03 job-queue battle plan written — LANDED — 2026-07-06
- Agent/session: planning session (read-only recon of the advance/queue/bus flow)
- Branch/PR: plan/higgsfield-competitor · (docs)
- Note: wargames 07 (bug hunt) and 08 (WO-01) have since been RUN — draft PRs #3 and #4 off the
  plan branch. 07 fixed a real silent `/live` replay-failure defect (+ smoke:race, smoke:live-replay);
  08 built real file I/O (uploads + validator-clean .glb). Those branches carry their own ledger
  entries; this plan-branch ledger records the wargame authoring.
- Done: `wargames/09-wo03-job-queue.md` — move-by-move build plan for WO-03 (durable queue + worker +
  refund ledger), full universal-template shape (assumption header, Move 0 ground truth, expected-obs/
  failure/counter per move, forks with triggers, RECON-NEEDED table, looks-broken-but-isnt list,
  confidence labels, abort conditions incl. MANUAL-PENDING, verification runs + paper trail + scoring).
  Indexed in wargames/README.md with carried intel.
- Discovered (carry into the WO-03 build):
  - **[on-paper] The persist+publish loop lives in the `/advance` HTTP handler** (app.ts:89-94), NOT in
    `runRealPipeline` (persists nothing). Worker must call a shared EXTRACTED helper or queue+live-stream
    diverge. Wargame Move 1 — do it first.
  - **[on-paper] `GET /jobs/:id/events` already exists as REST JSON** — add SSE on a NEW `/jobs/:id/stream`
    path, don't repurpose it.
  - **[on-paper] `LiveEvent` strict union, DOT-separated types** — add new queue events to the union
    (`job.done`, not `job:done`) or `LiveEvent.parse` throws.
  - Single-worker queue structurally fixes the wargame-07 concurrency race; keep one in-flight slot.
  - pg-boss needs `DIRECT_URL` (5432, not pooled); lazy-import so CI needs no DB.
- Next: run wargame 09 (build WO-03) on branch `wo/03-job-queue` off the plan branch.

### [WARGAME-07-RUN] Bug hunt executed — LANDED — 2026-07-06
- Agent/session: executor session (ran wargames/07-bugs.md move by move)
- Branch/PR: wargame/07-bugs · draft PR (see below)
- Verdicts (each decided by the probe named in the wargame):
  - #1 store-wide seq → **NOT-A-BUG** (Move 4 arbiter: cross-job resume returns only job-A
    events `s2,s3`; strict `>from` boundary holds — events bucketed per job before seq filter)
  - #2 concurrent advance race → **RECON-NEEDED, not reproducible on MemoryJobStore**: 20/20
    runs over a REAL listening server (paired concurrent fetches) = 6 stages, canonical order,
    no dupes. Node drains each handler's microtask chain before the next request; race needs
    real-I/O awaits → **flag carried to WO-03: prove/guard on the Supabase store** (its network
    awaits DO interleave). `smoke:race` kept wired into check as a canary for the WO-03 rewrite.
  - #3 /live replay→live seam → **clean** (10 events, 6 stage.completed, seqs unique+ordered;
    resume from last seq delivers 0 stale)
  - #4 list() same-ms ties → **NOT-A-BUG** (V8 stable sort ⇒ deterministic; cosmetic: ties are
    insertion-ordered inside a desc list — note for WO-05 if job lists become user-facing)
  - #5 engine:"both" collapse → **NOT-A-BUG** (label-only; export retains both ue5+unity blocks)
  - Move-7 sweep → **1 REAL DEFECT FIXED**: `/live` replay failure was silently swallowed
    (`src/app.ts` catch) → resuming client got a silent gap. Fix: emit protocol `error` event
    ("event replay failed; stream may have a gap"). Regression smoke `smoke:live-replay`
    proven by stash-red/restore-green ritual (FAIL without fix, PASS with). Other catches
    (client.ts, pg-bus, supabase-bus) are commented-intentional — left alone.
- Also: `@types/ws` added as devDependency (types-only, zero runtime) for the ws-client smokes.
- Probe gotcha for future ws smokes: attach `message` listener BEFORE `open` — first frames
  arrive immediately and are lost otherwise.
- Verification: `npm run check` green (13 smokes incl. race + live-replay); `pipeline:real`
  → status: passed, 6 stages, repairs 0 (behavior unchanged); ritual outputs pasted in PR.
- Next: merge decision on the fix PR (owner), then WO-01 (wargame 08) or WO-03 carries the #2 flag.
### [WO-01] Real file I/O built (wargame 08 executed) — IN-REVIEW — 2026-07-06
- Agent/session: executor session (ran wargames/08-wo01-file-io.md move by move)
- Branch/PR: wo/01-real-file-io · draft PR (see below), based on plan/higgsfield-competitor
- Done (all verified, commands pasted in PR):
  - `src/assets/store.ts`: `AssetStore` interface + `LocalAssetStore` (mints asset:// URIs,
    traversal-safe via resolve+startsWith on the RESOLVED path). `src/assets/glb.ts`: mesh→
    binary .glb via @gltf-transform/core.
  - `src/app.ts`: `buildApp` gained optional `assets` param (3rd, defaulted — existing 2-arg
    callers untouched); `POST /assets` (multipart, type allow-list, size cap→413) and
    `GET /assets/*` (streamed, 404 traversal-safe).
  - `runRealPipeline(job, ctx, assets?)`: on a passing REAL run, serializes the decimated mesh
    to a real .glb as a SIDE EFFECT and points artifacts.retopoMesh at the stored file. Emitted
    stage payloads unchanged (smoke:retopo + smoke:e2e stayed green → R4 satisfied).
  - `src/smoke-assets.ts` wired into `npm run check` (10 assertions incl. traversal/oversize/
    bad-type negatives). `data/` gitignored. Deps added: @fastify/multipart@10, @gltf-transform/core.
- Verified: `npm run check` green (12 pass lines); `pipeline:real` → status passed, EITL 0,
  6 stages (unchanged); manual HTTP round-trip 201/identical-bytes/400/404/alive; downloaded
  glb magic `glTF` + `gltf-transform validate` → 0 errors 0 warnings.
- Discovered (carry forward):
  - **Windows curl gotcha:** `curl -F file=@/tmp/x` fails with error 26 (Win curl.exe can't read
    MSYS /tmp paths) → looks like HTTP 000 / a server crash but is client-side. Use a repo-relative
    file path for manual curl tests. Cost real debugging time — logged so the next agent skips it.
  - @fastify/multipart is **v10** (not v9 as the wargame guessed) — imports clean under Fastify 5.
  - @gltf-transform/core writes a validator-clean GLB from Float32 positions + Uint32 indices
    with no min/max needed for `validate` to pass — the hand-rolled fallback was NOT required.
  - The unconsumed-multipart-stream-hangs risk (wargame Move 3 ②) did NOT bite; watched for it, clean.
- Next: owner merge decision on this PR. Then WO-02/WO-03 can start (WO-01's AssetStore contract
  is now real). WO-03 still carries the concurrency-race canary (smoke:race) from wargame 07.

### [WARGAME] Wargames 07 + 08 written; intel indexed — LANDED — 2026-07-06
- Agent/session: planning session (Claude), after read-only recon of the full pipeline
- Branch/PR: plan/higgsfield-competitor · PR #2 (draft)
- Done: `wargames/07-bugs.md` (bug-hunt battle plan), `wargames/08-wo01-file-io.md` (WO-01
  build battle plan), and `wargames/README.md` (index + carried intel — verified repo facts,
  DI/factory seams, scaffold boundary, bug-suspect verdicts, WO-01 traps + fallbacks). Wired
- Discovered (now carried in wargames/README.md so it's not lost):
  - Bug suspects are HYPOTHESES, not confirmed. Best guesses from recon: #1 concurrent-advance
    race is the real one (but maybe only on the Supabase store); #2 store-wide seq and #5
    engine:"both" collapse are likely NOT-A-BUG; #3/#4 minor. Executor must PROVE before fixing.
  - WO-01 specifics verified: no multipart/gltf deps yet; `Mesh` type at retopology.ts:5-8 is
    what serializes to .glb; `buildApp` new params must be optional-default (grep callers first).
- Next: unchanged — run wargame 08 (build WO-01) or 07 (bug hunt), or keep planning. Neither
  wargame executed yet; no product code exists.

### [PLAN] Bulletproofing pass: site spec, quality bar, adversarial review, WO-15..18 — LANDED — 2026-07-06
- Agent/session: planning session (Claude; two critique subagents hit session limits, so the
  adversarial review + site spec were done inline against the full research and codebase context)
- Branch/PR: plan/higgsfield-competitor · https://github.com/Kariimc/Omni-3d/pull/2 (draft)
- Done: SITE_SPEC.md (IA, landing spec, workspace UX rules, Studio Dark design direction),
  QUALITY_BAR.md (measurable release budgets + beats-Higgsfield head-to-head table),
  PLAN_REVIEW.md (contract fixes, 10-risk register with mandated fallbacks, acceptance
  hardening), new WO-15 (deploy/CI/status), WO-16 (design system + marketing site),
  WO-17 (quality gate as CI), WO-18 (safety + legal). Amended WO-01/03/04/05/08/12 with
  the review's fixes (pg-boss direct connection, service-key-bypasses-RLS, SwiftShader
  fallback, tokens contract, negative tests, tile-render fallback).
- Discovered:
  - Supabase SERVICE key bypasses RLS — API-layer ownership checks are the real mechanism
    (now in WO-05). Anyone touching Supabase reads must know this.
  - pg-boss cannot run over PgBouncer transaction pooling — use the direct connection string.
  - Design decision recorded: Studio Dark direction (SITE_SPEC §5), rejected alternatives
    documented so agents don't relitigate.
- Next: unchanged — start WO-01; also start WO-15 as soon as WO-03 lands (deploy early so
  every later WO verifies against a real environment).

### [SYNC] Owner merged #2/#3/#4/#5 to main; CLAUDE.md + skills landed; PROGRESS re-pointed at wargame 09 — LANDED — 2026-07-08
- Branch/PR: worked directly on `main` (docs/ledger sync only, no product code) — no new PR
- Done: owner merged PR #2 (plan), PR #3 (wargame-07 `/live` fix), PR #4 (WO-01 real file I/O),
  on `main`, zero open PRs. Re-verified the baseline directly on `main`:
  `npm install && npm run check` → GREEN, **13** smoke suites (12 + `smoke:assets` from WO-01).
  Updated the WO status board (WO-01 → LANDED → main; WO-02/03 rows note wargame status) and
  rewrote PROGRESS.md's "Next action" as a numbered, ranked move list so a fresh agent can
  start executing wargame 09 immediately with no re-derivation.
- Discovered:
  - PROGRESS.md and this ledger's status board had drifted from reality after the merges
    (still described PRs #3/#4 as open drafts, baseline as "12 smokes" on a "plan branch").
    Docs describing merge/PR state need a sync pass right after every owner merge, not just
    at WO boundaries — nothing else in the workflow currently triggers that check.
  - No wargame exists yet for WO-02 (engine bridge) — wargame 09 (WO-03) is the only
    ready-to-run plan; anyone picking WO-02 next must `/wargame` it first.
- Next: run wargame 09 → build WO-03 (durable job queue) on `wo/03-job-queue` off `main`,
  per the ranked steps now in PROGRESS.md "Next action". Nothing is blocked.
