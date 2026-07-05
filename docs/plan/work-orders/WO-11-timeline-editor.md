# WO-11 — Scene-graph timeline: multi-shot sequences beyond the 8-second wall

**Phase 3 · depends on WO-08, WO-09, WO-10 · branch `wo/11-timeline-editor`**

## Goal
Users sequence multiple shots (each = character + camera preset + motion/generation + optional audio) on a timeline and export one continuous video — 30 seconds, 3 minutes, whatever.

## Why
Community complaints #7 (8-second clip cap) and #10 (no editing timeline — "biggest expectation mismatch"; users leave for Runway's workflow depth). Because shots reuse 3D characters (WO-09), long sequences hold identity — the thing Higgsfield structurally can't do.

## Read first
- WO-08 render path + presets, WO-09 characters, WO-10 audio muxing, WO-03 queue (a sequence export = a parent job with child shot jobs), WO-04 web app structure.

## Spec
1. **Scene schema** (`src/schemas/scene.ts`, Zod): `Scene { id, projectId, shots: Shot[] }`; `Shot { characterId?, assetUri?, cameraPresetId, source: "render3d" | "hostedVideo", prompt?, durationSec, audio?: {speechText?, audioUri?}, transition: "cut" | "fade" }`. Export JSON Schema.
2. **API**: CRUD `/scenes`; `POST /scenes/:id/export {resolution}` → parent queue job that (a) renders/generates every shot (children, parallel where the queue allows), (b) concatenates with ffmpeg (apply fades via xfade), (c) muxes audio per shot, (d) returns one mp4 asset. Cost estimate for the whole scene via WO-06 (`/estimate` accepts a scene — sums shots; no hidden generations).
3. **Web timeline**: horizontal shot strip (thumbnail = character reference render or prompt card), drag to reorder, click to edit shot panel, per-shot duration, scene duration readout, Export button showing the estimate first.
4. **Progress**: export job streams per-shot progress over SSE (reuse WO-03 events; parent aggregates children).
5. Keep v1 honest: no frame-accurate trimming/scrubbing — shots are atomic blocks. Say so in the UI ("v1: shot-level editing").

## Acceptance
```bash
npm run check
npm run smoke:scene     # NEW (mock providers): 3-shot scene (two shots share characterId)
# → export produces ONE mp4; ffprobe duration ≈ sum of shots (±0.5s); paste ffprobe
# → estimate returned per-shot rows before export; two shots reference same geometryHash
```
Browser pass: build a 3-shot scene on the timeline, reorder by drag, export, play the result.

## Out of scope
Frame-level trim, transitions beyond cut/fade, collaborative editing, audio waveform editing.
