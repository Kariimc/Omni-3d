# WO-18 — Safety & legal: moderation without the Higgsfield failure modes

**Phase 3 · depends on WO-05, WO-07, WO-15 · branch `wo/18-safety-legal`**

## Goal
Hosted generation gets a published, versioned content policy enforced at request time, a report/appeal path, an audit trail, and the legal pages a real product needs (ToS, privacy, DMCA).

## Why
Research Part 1d: Higgsfield had a content-safety scandal (nonconsensual celebrity deepfakes incentivized by its creator program) AND community complaint #12 (overzealous filters blocking legitimate commercial work, tightened retroactively on paid users). Both failure modes are avoidable: clear published rules, applied at submission time, never retroactively — which TRUST.md already promises.

## Read first
- TRUST.md commitments (WO-14 spec §1 — "content rules published, versioned, never retroactive"), WO-07 gateway (the enforcement point for hosted models), WO-05 auth (who did what), RESEARCH_HIGGSFIELD.md Part 1d + Part 2 #12.

## Spec
1. **Policy** (`site/src/pages/legal/content-policy.md`, versioned `v1`, changelog at bottom): plain-language rules — no CSAM (hard block, report per legal obligations), no nonconsensual real-person likeness (real-person face inputs require the rights attestation checkbox; celebrity-name prompts on photoreal video models are blocked), no fraud/deception content. Local-engine generation is out of enforcement scope (user's own hardware) — say so explicitly.
2. **Enforcement** (`src/safety/`): pre-submission prompt screen (blocklist + pattern rules, table-driven, versioned with the policy); hosted-provider safety responses (fal/Replicate NSFW flags) mapped to a single `blocked_by_policy` job state that names the exact rule id — never a silent failure, never a vague "content violation". Blocked jobs are **never charged** (wire to ledger).
3. **Non-retroactivity by construction**: every job records `policyVersion` at submission; enforcement always evaluates the job's own version. Policy bumps apply to new jobs only. Test proves it.
4. **Report & appeal**: `POST /report {assetUri|jobId, reason}` (public) and `POST /appeals {jobId, message}` (auth'd) → rows the owner reviews (simple admin list route, auth'd + role-gated to owner account); response-time promise per TRUST.md.
5. **Audit log** (`src/safety/audit.ts`): append-only records for blocks, reports, appeals, admin actions.
6. **Legal pages**: ToS, privacy (GDPR-aware: data listed, deletion honored via a `DELETE /me` that purges user rows + assets), DMCA agent info page. Mark clearly as templates for owner's counsel review — an agent must not present these as legal advice.

## Acceptance
```bash
npm run check
npm run smoke:safety   # NEW: blocked prompt → blocked_by_policy + rule id + ledger uncharged;
                       # policyVersion pinning: bump table → old job re-eval unchanged (paste);
                       # report + appeal rows persist; audit entries written
# Pages render at /legal/*; content-policy shows version + changelog
```

## Out of scope
ML-based image moderation models, human-review tooling beyond the admin list, creator payout program (deliberately deferred — see PLAN_REVIEW §4).
