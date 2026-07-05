# WO-02 — Bridge the Python generation engine into the TS pipeline

**Phase 0 · depends on WO-01 · branch `wo/02-engine-bridge`**

## Goal
The free local generation engine (Python: FLUX/SDXL text→image, MiDaS depth image→3D, TRELLIS/TripoSR GPU tier, mock backend) currently lives in the `omni3d` skill folder, disconnected. After this WO it lives in this repo under `engine/` and the TS API can call it: text prompt → image → mesh `.glb`, all through `POST /pipeline`.

## Why
This is the "True Unlimited" differentiator (community complaint #1: Higgsfield's fake unlimited). Local open-model generation, zero per-asset cost, no throttling.

## Read first
- Copy source: `~/.claude/skills/omni3d/engine/` (whole tree: `omni_engine/` package, `requirements.txt`, `setup.sh`, `README.md`, `tests/`). Copy it into `engine/` in this repo (drop `__pycache__`).
- `engine/omni_engine/cli.py`, `preflight.py`, `backends/` — the existing CLI and backend-selection logic.
- TS side: `src/loops/real-providers.ts`, `src/config.ts`, WO-01's `src/assets/store.ts`.

## Spec
1. **Engine HTTP service** (`engine/omni_engine/server.py`, FastAPI + uvicorn): `POST /generate/image {prompt, backend?}` and `POST /generate/mesh {image_path, model?}` → file path of result; `GET /health` → chosen backends from preflight. Reuse existing backend code — this is a thin wrapper over what `cli.py` already does.
2. **TS client** (`src/engine/client.ts`): zod-validated client for the engine service; env `OMNI3D_ENGINE_URL` (default `http://localhost:8199`). Results are registered into the AssetStore so they come back as downloadable `asset://` URIs.
3. **New generation providers**: `textToImage` and `imageToMesh` providers callable ahead of Loop A — when a job has `text` but no `video`, the pipeline may synthesize the input image locally (respect existing schema; add an optional `features.localGeneration` flag).
4. **CI without GPU**: the engine's `mock` backend must make everything pass on CPU-only machines. Add `engine/README.md` note + a `npm run smoke:engine` that skips cleanly (with a printed SKIP) if Python/engine service is absent, and runs the mock path if present.
5. One-command dev startup: `npm run dev:all` (concurrently: engine server with mock/auto backend + TS server). Document in README.

## Acceptance
```bash
cd engine && pip install -r requirements.txt && python -m omni_engine.preflight
python -m omni_engine.server &                 # or uvicorn
npm run smoke:engine                            # mock backend: prompt → png → glb, green
npm run check                                   # still green (engine smoke wired in, skip-safe)
```
On a CUDA machine (document, don't gate CI on it): `--backend diffusers` produces a real image and `--model depth` a real textured `.glb`.

## Out of scope
GPU orchestration/scaling, TRELLIS install automation, hosted model providers (WO-07).
