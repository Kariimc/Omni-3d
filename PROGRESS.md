# PROGRESS

## Next session starts here → [docs/plan/SESSION_HANDOFF.md](docs/plan/SESSION_HANDOFF.md)

## Current focus
Higgsfield-competitor build plan is bulletproofed and ready: 18 work orders, site spec, measurable quality bar, adversarial risk register with mandated fallbacks. Plus two wargames: [07-bugs.md](wargames/07-bugs.md) (bug hunt) and [08-wo01-file-io.md](wargames/08-wo01-file-io.md) (executing WO-01, the first build). Tree clean, all pushed to PR #2. No product code written yet — planning phase complete.
Site requirements: [docs/plan/SITE_SPEC.md](docs/plan/SITE_SPEC.md) · Release bar: [docs/plan/QUALITY_BAR.md](docs/plan/QUALITY_BAR.md) · Risks/fallbacks: [docs/plan/PLAN_REVIEW.md](docs/plan/PLAN_REVIEW.md)
**Builder agents start here: [docs/plan/HANDOFF.md](docs/plan/HANDOFF.md)** (verified baseline, contracts, gotchas) and log everything in [docs/plan/BUILD_LEDGER.md](docs/plan/BUILD_LEDGER.md).
Plan: [docs/plan/MASTER_PLAN.md](docs/plan/MASTER_PLAN.md) · Evidence: [docs/plan/RESEARCH_HIGGSFIELD.md](docs/plan/RESEARCH_HIGGSFIELD.md) · Build instructions: [docs/plan/work-orders/](docs/plan/work-orders/)

## Next action
Start **WO-01** (real file I/O) — it unblocks everything. Then WO-02 and WO-03 in parallel. See the dependency graph in `docs/plan/work-orders/README.md`.

## State of the code (verified 2026-07-05)
- `npm run check` green: typecheck + validate + 11 smokes.
- `npm run pipeline:real` → `status: passed` — 6 real classic-CV stage providers.
- Gaps: artifacts are `asset://` manifests (no real files), no UI/auth/queue/billing, Python engine (in the omni3d skill's `engine/`) not yet merged/connected — exactly what the work orders fix.

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
