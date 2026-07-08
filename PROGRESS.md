# PROGRESS

## Next session starts here → [docs/plan/SESSION_HANDOFF.md](docs/plan/SESSION_HANDOFF.md)

## Current focus
Plan (#2), the wargame-07 `/live` fix (#3), WO-01 real file I/O (#4), and CLAUDE.md + `/smoke`,
`/wargame`, `/handoff` skills (#5) are all **MERGED to `main`**. No open PRs. Everything below is
ready to execute right now, straight off `main`, with zero setup and zero re-derivation needed.
Site requirements: [docs/plan/SITE_SPEC.md](docs/plan/SITE_SPEC.md) · Release bar: [docs/plan/QUALITY_BAR.md](docs/plan/QUALITY_BAR.md) · Risks/fallbacks: [docs/plan/PLAN_REVIEW.md](docs/plan/PLAN_REVIEW.md)
**Builder agents start here: [CLAUDE.md](CLAUDE.md) → [docs/plan/HANDOFF.md](docs/plan/HANDOFF.md)** + [wargames/README.md](wargames/README.md) (carried intel); log everything in [docs/plan/BUILD_LEDGER.md](docs/plan/BUILD_LEDGER.md).
Plan: [docs/plan/MASTER_PLAN.md](docs/plan/MASTER_PLAN.md) · Evidence: [docs/plan/RESEARCH_HIGGSFIELD.md](docs/plan/RESEARCH_HIGGSFIELD.md) · Build instructions: [docs/plan/work-orders/](docs/plan/work-orders/)

## Next action — ranked moves, pick up right here, no questions needed
Run **Wargame 09** → build **WO-03** (durable job queue) on branch `wo/03-job-queue` off `main`.
See [wargames/09-wo03-job-queue.md](wargames/09-wo03-job-queue.md) — written to run move-by-move
without questions. Ranked order for a fresh agent landing on this file:
1. `git checkout main && git pull && npm install && npm run check` — reproduce the green baseline
   in "State of the code" below (this is Move 0 in the wargame file too). Not green → STOP and
   report; do not fix unrelated things.
2. Read `wargames/09-wo03-job-queue.md` top to bottom, then the "WO-03 build intel" section of
   `wargames/README.md` carried intel — those facts are already settled, don't re-derive them.
3. Branch `wo/03-job-queue` off `main`, append a `STARTED` entry to `docs/plan/BUILD_LEDGER.md`,
   then execute the wargame's moves in order. Each move's "expected observation" is the
   checkpoint; on a miss, take its stated counter-move/fork — don't improvise a fix.
4. Finish per the wargame's final-verification list (`npm run check` green + a new `smoke:queue`
   suite). Open a draft PR with acceptance-command outputs pasted verbatim, update the ledger
   status board and this file's "Next action", stop there (`/handoff` does all of this).
5. After WO-03 lands, WO-02 (engine bridge) and WO-04 (web workspace) are next-unblocked per
   `docs/plan/HANDOFF.md` §9's contract table — no wargame is written for either yet, so run
   `/wargame` to produce one before building.

## State of the code (main, verified 2026-07-08)
- `npm run check` green: 13 smoke suites (typecheck + validate + smoke, live, bus, sampler,
  retopo, mesh, skin, retarget, voxel, e2e, race, live-replay, assets). `npm run pipeline:real`
  → `status: passed` — 6 real classic-CV stage providers.
- **Landed on `main`:** plan docs (#2), wargame-07 `/live` silent-failure fix (#3), WO-01 real
  file I/O (#4), CLAUDE.md operating manual + skills (#5).
- Gaps the WOs still fill: no queue/worker (WO-03, next — wargame 09 ready to run), no
  auth/billing/UI, Python engine not merged (WO-02, no wargame written yet).

## Key decisions
- Compete with Higgsfield on **trust** (honest billing/unlimited — their 3.2/5 Trustpilot wound) and **3D** (they have none): see MASTER_PLAN "The one-line strategy".
- Local-first: anything hosted must have a free local approximation (open models, user GPU).
- Every WO extends `npm run check`; TRUST.md promises become CI policy-gate tests (WO-14).
- Builder-agent protocol: one WO = one branch = draft PR; never merge to main without owner sign-off.

## Gotchas
- Full verified list lives in HANDOFF.md §12 — headline items:
- The "real pipeline" runs real algorithms on PROCEDURAL inputs (`buildStageContext()`) — uploads never reach it; that seam is WO-01/02's whole job.
- `public/` already serves a live dashboard at `/` — don't break it; WO-04's workspace is additive until it deliberately replaces it.
- Existing smokes assume the manual `advance` flow — WO-03 must keep it behind `features.manualAdvance`.
- Python engine is NOT in this repo yet — it's at `~/.claude/skills/omni3d/engine/` on the owner's machine until WO-02 merges it in.
- higgsfield.ai/pricing is JS-rendered; research pricing numbers conflict across sources — treat as approximate.
- Windows dev box: engine setup uses bash (`setup.sh`) — test scripts cross-platform or document Git Bash requirement.
