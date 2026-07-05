# WO-07 — Multi-model gateway: hosted frontier models + local engine behind one contract

**Phase 2 · depends on WO-02, WO-06 · branch `wo/07-model-gateway`**

## Goal
One unified API for image/video generation that routes to hosted providers (fal.ai, Replicate — reaching Kling, Flux, Wan, Hailuo, etc.) or the free local engine, with per-model cost rows feeding the cost meter.

## Why
Multi-model aggregation is Higgsfield's core value prop (most-praised feature) — table stakes for a competitor. Omni 3D's twist: the local engine is "model zero," always free, so the gateway is an upsell path rather than a paywall.

## Read first
- `src/engine/client.ts` (WO-02), `src/billing/costs.ts` (WO-06), `src/assets/store.ts` (WO-01), fal.ai and Replicate HTTP API docs (fetch current docs; both are simple REST + polling).

## Spec
1. **Contracts** (`src/gateway/contracts.ts`, Zod): `GenerateImageRequest/Result`, `GenerateVideoRequest/Result` (prompt, referenceImages[], durationSec, resolution, cameraHint?, seed). Results register files in the AssetStore.
2. **Adapters** (`src/gateway/providers/`): `local.ts` (wraps engine client), `fal.ts`, `replicate.ts`. Each declares `capabilities()` (modalities, max duration/res) and `costRows()` (merged into the WO-06 table at boot). Env: `FAL_KEY`, `REPLICATE_API_TOKEN`; adapters with missing keys report `unavailable`, never crash.
3. **Router** (`src/gateway/router.ts`): explicit `model` id wins; otherwise pick cheapest available meeting the request's constraints; **always prefer local when it satisfies the request** (trust positioning).
4. **API**: `POST /generate/image`, `POST /generate/video` → enqueued via WO-03 queue (they're jobs like any other: estimate, meter, refund-on-fail all apply). `GET /models` lists every model with availability + real credit cost — public, no auth (transparency).
5. **Mock provider** for CI: deterministic placeholder image/video bytes so smokes run keyless.

## Allowed new dependencies
None required (plain fetch); `@fal-ai/client` permitted if it meaningfully simplifies.

## Acceptance
```bash
npm run check
npm run smoke:gateway     # NEW, keyless: /models lists local+mock as available, fal/replicate
                          # as unavailable; mock image + video generate through the queue,
                          # ledger rows written; router picks local over mock-hosted when equal
# With FAL_KEY set (manual, document output): one real image via fal → downloadable asset
```

## Out of scope
Sora/Veo direct integrations (add adapters later), camera presets (WO-08), character conditioning (WO-09).
