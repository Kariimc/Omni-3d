# WO-01 — Real file I/O: asset:// URIs become real files

**Phase 0 · no dependencies · branch `wo/01-real-file-io`**

## Goal
Today the pipeline returns `asset://…` manifest URIs that point at nothing. After this WO, users can upload real input files and download a real `.glb` produced by the pipeline.

## Why
This is the single biggest gap between "schema-validated scaffold" and "product." Every later work order needs real bytes on disk.

## Read first
- `src/server.ts` (routes), `src/store/` (job store), `src/loops/real-providers.ts` and `src/loops/runner.ts` (where stage outputs are produced), `src/schemas/` + `docs/payloads/*.json` (asset URI shapes), `README.md`.

## Spec
1. **AssetStore interface** (`src/assets/store.ts`): `put(stream|buffer, meta) → assetUri`, `get(assetUri) → stream`, `stat(assetUri)`. One implementation now: `LocalAssetStore` writing under `OMNI3D_DATA_DIR` (default `./data/assets`). Design the interface so an S3/Supabase implementation can be added without touching callers.
2. **Upload**: `POST /assets` (multipart via `@fastify/multipart`) → `201 { uri: "asset://uploads/<uuid>.<ext>" }`. Validate content type (png/jpg/webp/mp4/mov/wav) and a size cap (env `OMNI3D_MAX_UPLOAD_MB`, default 200).
3. **Download**: `GET /assets/*` streams the file with correct content-type; 404 for unknown URIs. Path-traversal safe (resolve inside data dir only).
4. **Pipeline writes real artifacts**: stage A3 (retopo) and stage C (final) serialize their mesh to a real binary `.glb` via `@gltf-transform/core` and register it in the AssetStore; the job manifest's `asset://` URIs now resolve through `GET /assets/*`.
5. New Zod schema for upload/download responses; export to JSON Schema like existing payloads.

## Allowed new dependencies
`@fastify/multipart`, `@gltf-transform/core`.

## Acceptance (run these, paste output)
```bash
npm run check                                  # all existing smokes stay green
curl -F file=@docs/payloads/pipeline.job.json localhost:8787/assets   # → 400 (bad type)
curl -F file=@<any .png> localhost:8787/assets                        # → 201 + asset:// uri
npm run pipeline:real                          # → status: passed
# then: fetch the final artifact URI from the job manifest:
curl -o out.glb localhost:8787/assets/...      # → valid GLB: first 4 bytes are "glTF"
npx @gltf-transform/cli validate out.glb       # → no errors
```
Add `smoke:assets` script covering upload→pipeline→download and wire it into `npm run check`.

## Out of scope
S3/Supabase storage, auth, resumable uploads, video artifact rendering.
