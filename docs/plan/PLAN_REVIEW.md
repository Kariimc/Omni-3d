# PLAN REVIEW — adversarial pass, findings & resolutions (2026-07-05)

> Every finding below is either FIXED (plan files amended) or carries an explicit
> mitigation now written into the relevant WO. Builder agents: if you hit one of these
> risks, the fallback is already specified — follow it, log it in the ledger.

## 1. Contract & dependency fixes (applied)

| Finding | Resolution |
|---|---|
| WO-04 could invent its own visual language, then WO-16's design system arrives and forces a rewrite | WO-04 amended: consume `tokens.css` contract from WO-16 (or its interim stub) — never hardcode a second palette |
| Supabase RLS is meaningless if the API uses the **service key** (bypasses RLS) — WO-05 as written could pass its tests while every user can read every job through the API | WO-05 amended: ownership enforced in the API layer explicitly; RLS is defense-in-depth; test added: service-key path must still deny cross-user reads |
| `pg-boss` requires a **direct** Postgres connection; Supabase's default pooled connection (PgBouncer transaction mode) breaks it | WO-03 amended: use the direct connection string (port 5432 / `DIRECT_URL`); SimpleQueue fallback already specified |
| Nothing deployed = no site. No CI beyond local `npm run check`. No moderation, legal, observability | New WO-15 (deploy/ops/CI), WO-16 (marketing site + design system), WO-17 (quality gate), WO-18 (safety + legal) |
| SSE through proxies/CDNs gets buffered → progress UI freezes in production even though it worked locally | WO-15 spec: disable proxy buffering for `/jobs/*/events` (headers + platform config); WO-17 journey test runs against the DEPLOYED environment, not localhost |

## 2. Risk register (top risks, with the mandated fallback)

| # | Risk | L×I | Mitigation now in plan |
|---|---|---|---|
| 1 | Headless WebGL (puppeteer) for server render is flaky in CI/containers | H×M | WO-08: launch Chrome with SwiftShader (`--use-gl=angle --use-angle=swiftshader`); if still failing, CI uses the mock renderer and real rendering is verified on the owner's box — never block the queue pipeline on it |
| 2 | FBX/USDZ export needs Blender; agents may fake it | M×H | WO-13 already mandates honest-422 without Blender; never write a stub file |
| 3 | 4K headless render exceeds container memory | M×M | WO-12: tile-render fallback (render 2×2 tiles, stitch with ffmpeg) or document the ceiling; hosted 4K can be upscale-based |
| 4 | Bone-heat weights / silhouette carving quality on real photos is far below the icosphere demo — the "wow" gap | H×H | WO-02's GPU tier (TRELLIS/TripoSR) is the real quality path; classic-CV path is labeled "draft mode" in the UI (SITE_SPEC honesty rule — never oversell, we are the anti-Higgsfield) |
| 5 | fal/Replicate cost drift makes our estimates wrong → violates our own estimate-accuracy gate | M×H | WO-07: cost rows fetched/verified at boot where the provider exposes pricing; else pinned in config with a `verifiedAt` date; QUALITY_BAR D disables UI for job types failing the 5% rule |
| 6 | Python engine on Windows (no bash) breaks contributor setup | M×M | WO-02: `setup.ps1` twin or documented `pip install -r requirements.txt` path; CI runs Linux |
| 7 | Stripe webhooks unreachable in local dev | L×M | WO-14: `stripe listen` documented; wallet logic unit-tested without Stripe |
| 8 | Two half-finished UIs (existing `public/` dashboard vs new `web/`) confuse users | M×M | WO-04 exit criterion added: `/` redirects to `/app` once the workspace covers dashboard functionality; until then dashboard stays untouched |
| 9 | Scene export (WO-11) fan-out can starve the queue for everyone else | M×M | WO-03 queue supports per-job priority; WO-11 children run at low priority; status page (WO-15) makes any starvation visible |
| 10 | Agents "pass" acceptance by testing only mocks | H×H | Every WO's acceptance now distinguishes CI-mock vs verified-real; PR template (WO-15) has a "what ran REAL" section; WO-17's deployed-environment journey is the backstop |

## 3. Acceptance-criteria hardening (applied to WOs)

- WO-01: added negative tests (path traversal `GET /assets/../../etc`, oversized upload → 413).
- WO-03: durability test is mandatory, not "document which" — the smoke must kill/restart the worker programmatically.
- WO-04: browser verification must be a scripted Playwright run (screenshots attached), not "click around".
- WO-17 owns the cross-cutting proof: a full user journey on the deployed site.

## 4. Explicitly deferred (post-plan, do not build now)

Mobile apps; Premiere/Resolve plugins; UGC/ads template studio; marketplace; team seats/roles; SSO; creator payout program (do it right or not at all — see Higgsfield's Earn scandal in research Part 1d).
