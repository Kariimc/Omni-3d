# WO-03 — Durable job queue, progress events, and refund-on-failure semantics

**Phase 0 · depends on WO-01 · branch `wo/03-job-queue`**

## Goal
Replace "caller must POST advance 6 times" with a durable queue + worker that runs jobs to completion, streams progress, survives restarts, and records refund bookkeeping when a stage fails.

## Why
Community complaints #3 (charged for failed generations) and #8 (unpredictable queues). Honest queueing — visible position, automatic refund records — is a core trust differentiator. Also every UI (WO-04) and billing (WO-14) feature sits on this.

## Read first
- `src/server.ts` (advance flow), `src/loops/runner.ts`, `src/store/` (job store, Supabase/pg variants), `src/live/bus.ts` + `src/live/events.ts` (existing event bus — reuse it, don't build a second one), `src/config.ts`.

## Spec
1. **Queue**: `pg-boss` when `DATABASE_URL`/Supabase pg is configured; an in-process `SimpleQueue` fallback (FIFO, single worker, setImmediate loop) when not — dev must work with zero infra. Interface in `src/queue/queue.ts`, both behind it.
2. **Worker** (`src/queue/worker.ts`): consumes `pipeline.run` jobs, drives all stages via the existing runner, emits stage events on the live bus (`job:queued`, `job:stage:start/finish`, `job:failed`, `job:done`, each with `queuePosition` where known). Retries: 2 per stage with backoff; then mark failed.
3. **API**: `POST /pipeline` now enqueues (keep the old synchronous `advance` path working behind `features.manualAdvance` for the existing smokes); `GET /jobs/:id/events` = SSE stream of that job's bus events; `GET /queue/status` = depth + worker liveness.
4. **Refund bookkeeping** (`src/billing/ledger.ts` — bookkeeping only, no payments yet): every job start writes a `charge` row `{jobId, estimatedCredits, status}`; on failure the row flips to `refunded` automatically. Zod schema; stored via the existing store layer (in-memory + pg).
5. Graceful shutdown: worker finishes current stage, re-queues the job.

## Allowed new dependencies
`pg-boss`.

## Acceptance
```bash
npm run check                                        # green, old smokes intact
npm run smoke:queue                                  # NEW: enqueue → SSE shows 6 stage events → done
# durability test (in smoke or manual, document which):
#   enqueue job, kill worker after stage 2, restart → job completes; paste log
# failure test: job with forced-fail stage → ledger row status becomes "refunded"
```
Wire `smoke:queue` into `npm run check`.

## Out of scope
Real payments (WO-14), cost estimation math (WO-06), multi-worker scaling, priority tiers.
