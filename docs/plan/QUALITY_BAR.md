# QUALITY BAR — measurable "better than Higgsfield", enforced by CI (WO-17)

> Pass/fail numbers. A release that misses a MUST does not ship. WO-17 automates
> every automatable row; the rest are release-checklist items with an owner sign-off.

## A. Performance (marketing pages) — MUST, automated (Lighthouse CI)

| Metric | Budget |
|---|---|
| Lighthouse Performance / SEO / Best-practices | ≥ 95 each |
| Lighthouse Accessibility | ≥ 95 |
| LCP (landing, mid-tier mobile emulation) | < 1.8 s |
| INP | < 200 ms |
| CLS | < 0.1 |
| JS shipped to landing (gz) | < 200 KB excluding the 3D hero bundle; hero lazy-loads after LCP |

## B. Workspace app — MUST, automated (Lighthouse + Playwright)

| Metric | Budget |
|---|---|
| App shell Lighthouse Performance | ≥ 90 |
| Time from signup start → first generation running (scripted journey) | < 90 s, ≤ 3 steps, no credit card |
| Job progress event → UI update latency | < 500 ms (SSE, no polling) |
| 3D viewer first frame after asset ready | < 2 s for a 10 MB glb |

## C. Accessibility — MUST

- WCAG 2.2 AA on all marketing pages and core workspace flows (axe-core scan: 0 critical/serious violations, automated).
- Full keyboard path: create job → watch progress → download result, verified by a Playwright test that never uses the mouse.

## D. Honesty gates — MUST, automated (these ARE the brand)

- Dark-pattern checklist as tests: default billing period is monthly; pay-button label equals the exact charge; no countdown/urgency components exist in the codebase (lint rule for banned component names); cancel flow ≤ 2 clicks from account page.
- Estimate accuracy: for the standard test matrix, `|actual − estimate| / estimate ≤ 5%`; any job type failing this is disabled from the UI rather than shipped with a wrong estimate.
- Queue honesty: displayed expected wait vs actual wait, p50 error ≤ 30% on the test window.
- TRUST.md policy gates (WO-14 tests) green: no credit expiry, auto-refund on failure, local mode billing-free.

## E. Beats-Higgsfield head-to-head — SHOULD, manual checklist per release

Documented Higgsfield numbers (research 2026-07) vs ours, re-checked each release:

| Dimension | Higgsfield (documented) | Omni 3D target |
|---|---|---|
| Free tier | watermarked, 10 credits/day | no watermark, local tier unlimited |
| Credit expiry | 90-day top-ups, monthly forfeit | never expires (CI-gated) |
| Failed generation | credits consumed | auto-refund (CI-gated) |
| Character consistency | Soul ID, drifts across models | geometry-hash-identical (CI-gated, WO-09) |
| Camera moves | ~60–70% first-pass hit rate | deterministic on 3D renders (100% by construction) |
| Max native resolution | 1080p (720p unlimited tier) | 4K included |
| Sequence length | ~8 s | minutes (scene timeline) |
| 3D asset output | none | glb/gltf/obj (+fbx/usdz with Blender) |
| API access | high tiers only, sparse docs | all tiers, OpenAPI + docs page |
| Pricing page | annual-default, hidden math | monthly-default, calculator, exact totals |

## F. Release protocol

1. CI green = sections A–D pass on the release candidate.
2. Section E checklist filled in the release PR by the releasing agent.
3. Any regression against a previously-passing row = blocked release, ledger entry, fix first.
