# WO-15 — Deployment, CI, and observability: the site actually exists

**Phase 1 (start early — everything else verifies against it) · depends on WO-01, WO-03 · branch `wo/15-deploy-ops`**

## Goal
The API + workspace + marketing site run on a public URL with CI that blocks broken merges, error tracking, a public status page, and backups. "It works on my machine" stops being the definition of done.

## Why
Adversarial review finding: the plan had 14 WOs and zero deployment story — no competitor site exists without hosting, CI, and visible reliability. The public status page is also a trust feature (QUALITY_BAR D queue-honesty).

## Read first
- `src/server.ts`, `src/config.ts` (env), WO-03 queue/worker split, `package.json` scripts, PLAN_REVIEW.md §2 (SSE buffering risk).

## Spec
1. **Containers**: multi-stage `Dockerfile` (api+worker in one image, `CMD` switches by `ROLE=api|worker`); `docker-compose.yml` for local full-stack (api, worker, postgres). Engine container (`engine/Dockerfile`, CPU/mock mode) optional profile.
2. **Host**: Fly.io (api + worker apps, Fly Postgres or Supabase pg) — config in `fly.toml`, deploy via `fly deploy` from CI on main. Static marketing site (WO-16) to Cloudflare Pages or Fly static — decide with WO-16, record in ledger.
3. **CI (GitHub Actions)** `.github/workflows/ci.yml`: on PR — `npm ci && npm run check`, engine mock tests (`pytest engine/tests`), and (once WO-17 lands) Lighthouse/axe budgets. On main — deploy staging, run WO-17 journey against staging, then promote to prod. PR template (`.github/pull_request_template.md`) with sections: acceptance output pasted · what ran REAL vs mock · ledger updated? (PLAN_REVIEW risk #10).
4. **SSE in production**: ensure `/jobs/:id/events` sets `Cache-Control: no-cache`, `X-Accel-Buffering: no`, heartbeat comment every 15 s; verify through the deployed proxy, not localhost.
5. **Observability**: Sentry (`@sentry/node`) behind `SENTRY_DSN` (no-op unless set); structured request logging; `/metrics` basic counters (jobs run/failed, queue depth, per-stage duration).
6. **Status page** `/status` (public, no auth): queue depth, worker liveness, 24 h generation success rate, p50/p95 stage durations — from the WO-03 store; plain HTML server-rendered by Fastify (no dependency on the web app).
7. **Backups & secrets**: document pg backup schedule (Fly/Supabase native) in `docs/OPS.md`; secrets only via platform env — add a CI grep gate blocking committed secrets (simple regex set).

## Allowed new dependencies
`@sentry/node`; dev: none beyond GitHub Actions.

## Acceptance
```bash
docker compose up  # local full stack; POST /pipeline → job completes via worker
# CI: open a PR with a deliberately failing smoke → CI blocks it (link the run)
# Deployed: curl https://<staging>/health → ok; SSE stream through the proxy delivers
#   stage events without buffering (paste curl -N output with timestamps)
# /status renders real queue numbers; Sentry receives a forced test error
```

## Out of scope
Autoscaling, CDN tuning, multi-region, GPU workers (engine runs CPU/mock hosted; GPU stays local-first for now).
