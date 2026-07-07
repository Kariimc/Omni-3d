# WO-09 — Character anchor: zero-drift consistency from the 3D asset

**Phase 2 · depends on WO-07, WO-08 · branch `wo/09-character-anchor`**

## Goal
Save a finished rigged asset as a reusable **Character**; every later shot that references it is rendered from (or conditioned on) the same 3D model — identity cannot drift because it's the same geometry.

## Why
Higgsfield's Soul ID is loved but drifts across models and multi-shot sequences (community complaint #11). A 3D anchor is the structural fix: same mesh + same textures = same character from any angle, in any motion, forever. This is Omni 3D's flagship differentiator feature.

## Read first
- `src/store/` (job store patterns), WO-05 projects (characters belong to projects), WO-07 `GenerateVideoRequest.referenceImages`, WO-08 server render, `src/loops/real-providers.ts` (where the final rigged asset comes from).

## Spec
1. **Model** (`src/schemas/character.ts`, Zod): `{ id, projectId, name, sourceJobId, assetUri (rigged glb), referenceRenders: assetUri[], geometryHash }`. `geometryHash` = sha256 of the glb's binary buffer chunk (proves identity in tests).
2. **API**: `POST /characters {jobId, name}` — takes a completed job's final asset, auto-generates 6 reference renders (front/back/left/right/three-quarter/face close-up) via the WO-08 render path, stores all. `GET /characters`, `GET /characters/:id`. Project-scoped per WO-05.
3. **Use in generation**: `GenerateVideoRequest` gains `characterId`; router resolves it to reference images passed to hosted models (image conditioning), and for local/3D-rendered shots the actual asset is used directly.
4. **Use in pipeline**: a new pipeline job may set `characterId` to skip Loop A entirely (reuse mesh) and run only motion/retarget stages with a new motion video — "same character, new animation" is a first-class flow.
5. **Web**: Characters tab in the project; "Save as Character" button on a finished job; character picker on generation screens showing the reference renders.

## Acceptance
```bash
npm run check
npm run smoke:character    # NEW:
# 1. run mock pipeline → save character → 6 reference renders exist
# 2. new job with characterId + skip-loop-A → completes; final glb geometryHash
#    EQUALS the character's geometryHash (paste both hashes)
# 3. /generate/video with characterId (mock provider) receives the reference images
```
Browser pass: save a character, start a "new animation" job from it, see it in the picker.

## Out of scope
Face-swap/likeness from user photos, character editing/morphs, marketplace.
