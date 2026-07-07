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
- Discovered: <anything the next agent must know: quirks, decisions, drift>
- Next: <the exact next action if unfinished>
- BLOCKED-ON: <WO-NN / credentials / owner decision — omit if not blocked>
```
STATUS ∈ `STARTED | WIP | BLOCKED | IN-REVIEW | LANDED | CORRECTION`

## WO status board (edit this table in place — the one exception to append-only)

| WO | Status | Branch | PR |
|----|--------|--------|----|
| 01 real file I/O | not started | — | — |
| 02 engine bridge | not started | — | — |
| 03 job queue | not started | — | — |
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
  HANDOFF.md, this ledger. Baseline verified green on the owner's Windows 11 box:
  `npm install` + `npm run check` → all 11 smokes pass; `pipeline:real` → status passed
  (A1 kept 2/4 frames | A2 3415 voxels | A3 20480→10000 tris | C E=0).
- Discovered:
  - `public/` already serves a live dashboard at `/` — earlier plan text saying "no UI"
    is wrong; HANDOFF §3 corrects it. WO-04 must not break `/` until deliberate.
  - The "real pipeline" runs real algorithms on PROCEDURAL inputs — `buildStageContext()`
    in `src/loops/real-providers.ts` fabricates frames/mesh/motion. Uploaded media never
    reaches the pipeline. This is THE seam for WO-01/02 (HANDOFF §6).
  - Python engine lives OUTSIDE this repo at `~/.claude/skills/omni3d/engine/` on the
    owner's machine — WO-02 copies it in. If building WO-02 from a different machine,
    ask the owner for that folder or pull it from the omni3d skill.
  - `advanceJob`'s third arg (per-stage overrides) is the DI seam everything plugs into.
  - Jimp v1 + meshoptimizer-WASM API quirks: see HANDOFF §12.
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

### [WARGAME] Wargames 07 + 08 written; intel indexed — LANDED — 2026-07-06
- Agent/session: planning session (Claude), after read-only recon of the full pipeline
- Branch/PR: plan/higgsfield-competitor · PR #2 (draft)
- Done: `wargames/07-bugs.md` (bug-hunt battle plan), `wargames/08-wo01-file-io.md` (WO-01
  build battle plan), and `wargames/README.md` (index + carried intel — verified repo facts,
  DI/factory seams, scaffold boundary, bug-suspect verdicts, WO-01 traps + fallbacks). Wired
  the index into SESSION_HANDOFF.md and HANDOFF.md so no builder/debugger misses it.
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
