# PROGRESS

## Current focus
Higgsfield-competitor build plan is written and ready for execution by builder agents.
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
- Existing smokes assume the manual `advance` flow — WO-03 must keep it behind `features.manualAdvance`.
- higgsfield.ai/pricing is JS-rendered; research pricing numbers conflict across sources — treat as approximate.
- Windows dev box: engine setup uses bash (`setup.sh`) — test scripts cross-platform or document Git Bash requirement.
