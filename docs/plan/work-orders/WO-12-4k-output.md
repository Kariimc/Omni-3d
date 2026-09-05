# WO-12 — 4K output path, upscaling included in every tier

**Phase 3 · depends on WO-02, WO-08 · branch `wo/12-4k-output`**

## Goal
Every output can be delivered at up to 4K: 3D renders natively (they're resolution-free), generated images/videos via included upscaling — never as a paid add-on.

## Why
Community complaint #5: Higgsfield caps at 1080p (720p on unlimited) and charges 12–20+ extra credits for upscaling, while Runway/Kling ship 4K. "4K included" is a simple, loud differentiator.

## Read first
- `engine/` service (WO-02 — upscalers live Python-side), WO-08 server render (`resolution` param), WO-07 contracts (`resolution`), WO-06 cost table (upscale rows must exist and be **0 for local**).

## Spec
1. **Engine upscalers**: extend `engine/` with `/upscale/image` (Real-ESRGAN x2/x4; CPU fallback works, just slow) and `/upscale/video` (frame-extract via ffmpeg → per-frame Real-ESRGAN → reassemble at source fps, preserve audio stream). Mock backend: plain bicubic resize so CI stays green and fast.
3. **Native-res renders**: WO-08's server render must accept up to 3840×2160 directly — verify the headless canvas path at 4K and document memory limits.
4. **Auto-finish option**: job payloads and scene exports (WO-11) gain `finish: { targetResolution }` — pipeline appends an upscale step when the source is below target. Estimate includes it as an explicit row (no hidden work — WO-06 principle).
5. **Web**: resolution picker (720p/1080p/4K) on render/export screens; "included, 0 credits (local)" label.

## Acceptance
```bash
npm run check
npm run smoke:upscale    # NEW (mock/bicubic): 640×360 png → x4 → 2560×1440 (verify dims);
                         # short mp4 → upscaled mp4, same duration & fps, audio preserved
                         # (paste ffprobe of both)
# Manual with Real-ESRGAN installed (document): real x4 on a sample, before/after saved
```
4K server render: turntable at 3840×2160 completes (or documents the real memory ceiling found). **Fallback (PLAN_REVIEW risk #3):** if 4K exceeds container memory, tile-render (2×2 tiles at 1920×1080, stitch with ffmpeg) rather than capping resolution.

## Out of scope
Hosted upscale providers (Topaz etc.), face-restoration models, HDR.
