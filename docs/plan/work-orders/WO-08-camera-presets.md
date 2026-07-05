# WO-08 — Camera-move preset library: real 3D camera paths, not prompt lottery

**Phase 2 · depends on WO-04, WO-07 · branch `wo/08-camera-presets`**

## Goal
A library of named cinematic camera moves (orbit, dolly-in, crane-up, FPV flythrough, crash zoom, bullet-time…) that render **deterministically** over the user's actual 3D asset, plus best-effort mapping to text hints for hosted video models.

## Why
Higgsfield's DoP presets are its signature feature — but they're generation-time guidance with a ~60–70% hit rate. Because Omni 3D has the real 3D asset, our camera moves are true camera curves: 100% repeatable, any resolution, any length. Same familiar feature, structurally better.

## Read first
- WO-04's `web/` viewer (three.js scene), `src/gateway/contracts.ts` (`cameraHint`), `src/assets/store.ts`.

## Spec
1. **Preset schema** (`src/schemas/camera-preset.ts`, Zod): id, display name, category, parametric path (keyframes of position/lookAt/fov over normalized time, spline interp), default duration, and `textHint` (for hosted models via WO-07's `cameraHint`).
2. **Library** (`presets/cameras.json`): ≥30 presets across categories: orbits (slow/fast/spiral), dollies (in/out/side), crane (up/down/reveal), FPV (flythrough/dive), dramatic (crash zoom, bullet-time arc, vertigo/dolly-zoom), product (turntable, hero-tilt, macro-sweep). Each validated against the schema in `npm run validate`.
3. **Client render**: viewer gains a preset picker + Play; camera animates along the path; **Record** exports a WebM via `MediaRecorder` on the canvas (this keeps v1 dependency-free server-side).
4. **Server render** (`POST /render/camera {assetUri, presetId, resolution, durationSec}`): headless render → mp4. Implement with puppeteer driving the same viewer page + ffmpeg assembly; runs as a WO-03 queue job. If puppeteer proves too heavy in CI, mock-render (solid frames + correct metadata) in CI and document the real path.
5. Preset picker also appears on hosted video generation (WO-07 flow), sending `textHint`.

## Allowed new dependencies
`puppeteer` (server render), ffmpeg invoked as external binary (`ffmpeg-static` permitted).

## Acceptance
```bash
npm run check              # presets validate; smoke:cameras wired in
npm run smoke:cameras      # NEW: schema-validate all presets; server render (real or CI-mock)
                           # of "turntable" over a sample glb → mp4 exists, duration matches
# Browser pass: pick "crash-zoom" on a finished job's asset → plays + Record saves a webm
```

## Out of scope
Path editor UI (users authoring custom paths), lighting presets, multi-camera scenes (WO-11).
