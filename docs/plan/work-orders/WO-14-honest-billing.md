# WO-14 — Honest billing + TRUST.md: the anti-Higgsfield economics

**Phase 3 · depends on WO-05, WO-06 · branch `wo/14-honest-billing`**

## Goal
Real payments with the trust rules as **code**: wallet credits that never expire, monthly-default checkout showing the exact charge, automatic refunds for failed jobs, and a public TRUST.md the product must obey.

## Why
This is the #1, #2, #3 community wound with Higgsfield (fake unlimited, annual-default checkout charging $1,188 off a "$99/mo" label, 90-day credit expiry, refund obstruction → 3.2/5 Trustpilot, BBB complaints, review-bombing). Their churn is trust destruction — we make trust the product.

## Read first
- WO-03/06 ledger (`src/billing/ledger.ts`, `costs.ts`), WO-05 auth/users, Stripe Checkout + webhooks docs (test mode), `README.md`.

## Spec
1. **TRUST.md** (repo root, linked prominently from README and the web footer). Commitments, verbatim policy:
   - Credits never expire. Ever. Unused credits roll over indefinitely.
   - Failed generations are auto-refunded — you pay only for delivered results.
   - Monthly billing is the default; the checkout button always shows the exact amount charged today.
   - 30-day no-questions refund on first purchase; cancel anytime keeps remaining credits usable.
   - Local generation is free forever, no account required, no watermark.
   - No retroactive plan changes: caps/limits changes apply to NEW purchases only.
   - Content rules are published, versioned, and never applied retroactively to paid time.
   - Support: first human response within 24h; status page for queue health.
2. **Wallet** (`src/billing/wallet.ts`): balance = sum of ledger entries (purchases, spends, refunds) — no expiry logic anywhere by design; concurrency-safe (single UPDATE with balance check or serializable tx).
3. **Stripe**: Checkout for credit packs + monthly subscription (subscription just auto-purchases a pack — so "rollover" is inherent). Webhook `checkout.session.completed` → ledger purchase. Display rule enforced in web: the pay button label contains the exact charge amount. No annual option is even built in v1.
4. **Enforcement hooks**: WO-03's failure path already flips charges to `refunded` — wire it to the real wallet; `budget_exceeded` likewise. Local-provider jobs bypass billing entirely (0-cost rows, no wallet needed, no login needed).
5. **Tests as policy-gates** (`tests/trust-gates.test.ts` or smoke): (a) time-travel a wallet 400 days → balance unchanged; (b) failed job → balance restored; (c) checkout payload asserts `mode != subscription-annual` and label == charged amount; (d) anonymous local-mode pipeline run touches no billing code path. These tests ARE TRUST.md — a future change that breaks a promise must break CI.

## Allowed new dependencies
`stripe`.

## Acceptance
```bash
npm run check            # includes trust-gate tests, green
npm run smoke:billing    # NEW: wallet ops correct under concurrent spends (paste balances);
                         # Stripe test-mode checkout → webhook → credits land (stripe CLI listen)
```
TRUST.md exists at repo root; README links it; web footer links it.

## Out of scope
Annual plans (deliberately), team billing, invoicing, tax handling (Stripe Tax later), creator payouts.
