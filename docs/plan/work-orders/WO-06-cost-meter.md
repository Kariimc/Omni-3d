# WO-06 — Cost estimate API + live spend meter + hard budget cap

**Phase 1 · depends on WO-03 · branch `wo/06-cost-meter`**

## Goal
Before any job runs, the user sees what it will cost; while it runs, a live meter shows actual spend; a per-job budget cap aborts (with auto-refund record) before overrunning.

## Why
Community complaint #4: Higgsfield's agent features silently burned 3× the expected credits, and its mobile app silently flipped users from unlimited to credit spend. Radical cost transparency is a headline feature — even while everything is still free, ship the machinery.

## Read first
- WO-03's `src/billing/ledger.ts` and queue/worker, `src/loops/runner.ts` (stage boundaries), `src/config.ts`, WO-04 `web/` job view.

## Spec
1. **Cost table** (`src/billing/costs.ts`): table-driven credits per stage per quality tier (local engine stages cost **0** — that's the point); include hosted-model placeholder rows for WO-07 to fill. Zod schema, exported to JSON Schema like other payloads.
2. **Estimate**: `POST /estimate` with a pipeline payload → `{ total, perStage[], assumptions[] }`. Must enumerate *every* generation the job will trigger (the Higgsfield failure was hidden intermediary generations).
3. **Live spend**: worker writes actual per-stage cost to the ledger as each stage finishes; SSE events gain `creditsSpent` / `creditsEstimated`.
4. **Budget cap**: optional `budgetCap` on the job payload; before each stage, worker checks `spent + nextStageEstimate <= cap`, else aborts the job with status `budget_exceeded` and the standard failure-refund path from WO-03.
5. **Web**: estimate shown on the New-job screen before Run; meter (spent / estimated, progress bar) on the Job view; `budget_exceeded` state explained in plain words.

## Acceptance
```bash
npm run check
npm run smoke:cost        # NEW:
# 1. /estimate on the sample payload returns per-stage rows summing to total
# 2. full mock run: final ledger actuals == estimate (deterministic mock costs)
# 3. budgetCap set below stage-3 cumulative cost → job aborts at stage 3,
#    ledger shows refunded, no further stages ran
```
Paste all three outputs. Wire `smoke:cost` into `npm run check`.

## Out of scope
Real money, plan tiers, Stripe (WO-14); hosted-model real prices (WO-07 fills the table).
