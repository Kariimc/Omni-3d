# PROGRESS

## Next session starts here → [docs/plan/SESSION_HANDOFF.md](docs/plan/SESSION_HANDOFF.md)

## Current focus
Plan is bulletproofed (18 WOs, site spec, quality bar, risk register) AND the first two wargames have been EXECUTED. Three wargames: [07-bugs.md](wargames/07-bugs.md) (RAN → PR #3, fixed a real silent-failure defect), [08-wo01-file-io.md](wargames/08-wo01-file-io.md) (RAN → PR #4, built real file I/O), [09-wo03-job-queue.md](wargames/09-wo03-job-queue.md) (written, ready to run). Three open draft PRs: #2 (plan), #3 (fix), #4 (WO-01).
Site requirements: [docs/plan/SITE_SPEC.md](docs/plan/SITE_SPEC.md) · Release bar: [docs/plan/QUALITY_BAR.md](docs/plan/QUALITY_BAR.md) · Risks/fallbacks: [docs/plan/PLAN_REVIEW.md](docs/plan/PLAN_REVIEW.md)
**Builder agents start here: [docs/plan/HANDOFF.md](docs/plan/HANDOFF.md)** + [wargames/README.md](wargames/README.md) (carried intel); log everything in [docs/plan/BUILD_LEDGER.md](docs/plan/BUILD_LEDGER.md).
Plan: [docs/plan/MASTER_PLAN.md](docs/plan/MASTER_PLAN.md) · Evidence: [docs/plan/RESEARCH_HIGGSFIELD.md](docs/plan/RESEARCH_HIGGSFIELD.md) · Build instructions: [docs/plan/work-orders/](docs/plan/work-orders/)

## Next action
Run **Wargame 09** → build **WO-03** (durable job queue) on branch `wo/03-job-queue` off the plan branch. See [wargames/09-wo03-job-queue.md](wargames/09-wo03-job-queue.md) — runs move-by-move without questions. (Or: owner merges PRs #3/#4 first.)

## State of the code (plan branch, verified 2026-07-06)
- `npm run check` green: 12 smoke suites. `npm run pipeline:real` → `status: passed` — 6 real classic-CV stage providers.
- **Landed on branches (draft PRs):** WO-01 real file I/O (#4, `IN-REVIEW`), wargame-07 `/live` silent-failure fix (#3).
- Gaps the WOs still fill: no queue/worker (WO-03, next), no auth/billing/UI, Python engine not merged (WO-02).

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
