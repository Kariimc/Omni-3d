# WO-17 — Quality gate: QUALITY_BAR becomes CI, not opinion

**Phase 3 (lands with the first public release) · depends on WO-04, WO-15, WO-16 · branch `wo/17-quality-gate`**

## Goal
Automate every automatable row of [../QUALITY_BAR.md](../QUALITY_BAR.md) and wire it into WO-15's CI so a release that misses a MUST cannot merge.

## Why
Adversarial review risk #10: agents can "pass" acceptance with mocks. This WO is the backstop — it tests the deployed site the way a real user hits it, and it encodes the honesty gates that ARE the brand.

## Read first
- [../QUALITY_BAR.md](../QUALITY_BAR.md) (the requirements — every row maps to a check here), WO-15 CI workflow, WO-04 workspace routes, WO-16 site pages, PLAN_REVIEW.md §3.

## Spec
1. **Journey tests** (Playwright, `e2e/`): run against a target URL (env `E2E_BASE_URL` — staging in CI):
   - `journey-first-asset.spec`: landing → start free → create job (mock-fast pipeline via a staging flag) → progress rail updates via SSE → viewer renders → download glb. Asserts the <90 s / ≤3 steps budget (QUALITY_BAR §B) with measured timings in the report.
   - `journey-keyboard.spec`: the same flow with keyboard only (QUALITY_BAR §C).
   - `journey-honesty.spec`: Run button label equals `/estimate` total; queue chip shows before submit; failed job (forced via `?defect=`) shows the refund note and the ledger row is `refunded`.
2. **Lighthouse CI** (`lhci`): budgets file encoding §A and §B app-shell numbers; runs on staging URLs for landing, /pricing, /trust, /app shell.
3. **axe scans**: `@axe-core/playwright` on every marketing page + core workspace screens; fail on critical/serious.
4. **Dark-pattern lint**: repo-level check (script in `scripts/honesty-lint.mjs`): bans component/file names matching countdown|urgency|exit-intent; asserts pricing page source shows monthly before annual; runs in `npm run check`.
5. **Estimate-accuracy harness**: `e2e/estimate-accuracy.spec` runs the standard job matrix on staging, compares ledger actuals vs estimates, fails at >5% drift (QUALITY_BAR §D).
6. **Release checklist**: `.github/release-checklist.md` — QUALITY_BAR §E head-to-head table to fill per release; CI posts a reminder comment on release PRs.

## Allowed new dependencies (dev)
`@playwright/test`, `@lhci/cli`, `@axe-core/playwright`.

## Acceptance
```bash
npm run check                     # honesty-lint wired in, green
E2E_BASE_URL=<staging> npx playwright test   # all journeys green — paste report summary incl. measured first-asset time
npx lhci autorun                  # budgets met — paste scores table
# CI: link one run where a deliberately-broken budget (temp commit) BLOCKED the merge, then revert
```

## Out of scope
Visual-regression snapshots (add later), load testing, chaos testing.
