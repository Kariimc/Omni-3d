# WARGAME 08 — Executing WO-01 (real file I/O)

> Battle plan for a cheaper executor building the first real feature. **Read this whole
> file, then [../docs/plan/work-orders/WO-01-real-file-io.md](../docs/plan/work-orders/WO-01-real-file-io.md), then
> [../docs/plan/HANDOFF.md](../docs/plan/HANDOFF.md) §4–6, before any edit.** Written so you can
> run it end to end without asking a question. WO-01 is the critical-path unblocker — every
> later work order needs real bytes on disk.

## Mission

Implement WO-01: uploaded input files get a home, and the pipeline writes a **real `.glb`**
you can download — replacing the `asset://` manifest URIs that today point at nothing.
Keep `npm run check` green; add a `smoke:assets` that proves upload→pipeline→download and
the negative cases (path traversal, oversize).

### Guardrails (hard rules)
- Branch `wo/01-real-file-io` off `plan/higgsfield-competitor`. Draft PR. Never merge to main.
- Design `AssetStore` as an **interface** with a `LocalAssetStore` impl — so S3/Supabase can be added later without touching callers (WO-01 spec item 1).
- Only deps WO-01 allows: `@fastify/multipart`, `@gltf-transform/core`. Nothing else.
- Do **not** alter pipeline stage output the existing smokes assert. You are *adding* a real serialization + I/O layer, not changing geometry.
- Log every move in `docs/plan/BUILD_LEDGER.md`; flip the WO-01 status-board row.

---

## Recon already done for you (verified 2026-07-06 — don't re-derive)

- **No `@fastify/multipart` or `@gltf-transform/*` installed yet** — you add them.
- **The mesh type already exists:** `interface Mesh { positions: Float32Array; indices: Uint32Array }` (`src/loops/providers/retopology.ts:5-8`). The real pipeline builds `icosphere(5)` (20,480 tris, watertight) in `buildStageContext()` (`src/loops/real-providers.ts:124-144`) and decimates it at A3. **This `Mesh` is what you serialize to `.glb`.**
- **Server entrypoint:** `src/server.ts` — `createJobStore()` + `createEventBus()` + `buildApp(store, bus)` + `listen`. Routes live in `src/app.ts` (`buildApp` is a pure factory; tests use `app.inject()`).
- **`buildApp(store, bus)` signature is the seam** to register new routes and pass an `AssetStore` through. It reads `public/` files at module load (don't disturb).
- **Artifact URIs today:** `buildJobEnvelope` (`src/schemas/request.ts:74-82`) hardcodes `asset://<jobId>/mesh_retopo.glb` etc. as strings. The generators emit matching `asset://…` strings. None resolve to files.
- **Smokes are bespoke `tsx` scripts** wired into `npm run check`; `meshoptimizer` is WASM with an `await MeshoptSimplifier.ready` gate (`retopology.ts:49`) — `@gltf-transform` init is likely sync, but treat any WASM/async init as a gotcha (Move 4).
- **Windows dev box** (Git Bash/PowerShell). Use `node:path` joins; never hardcode `/`-rooted paths. Watch CRLF warnings (harmless).

---

## The plan, move by move

### Move 0 — Baseline green + branch
```bash
cd /c/Users/Kariim/Desktop/Omni-3d
git status && git branch --show-current      # clean, plan/higgsfield-competitor
npm install && npm run check                  # PASS, 11 smokes green
git checkout -b wo/01-real-file-io
```
- **Expected:** clean tree; `check` ends `PASS`; new branch created.
- **Most likely failure:** `check` already red. **Cause:** env drift. **Counter-move:** `node --version` (≥20), reinstall, confirm branch/commits per SESSION_HANDOFF. **Do not build on a red baseline.**
- **Fork — trigger:** baseline can't go green in 15 min → **ABORT A1**.

### Move 1 — Install the two allowed deps
```bash
npm install @fastify/multipart @gltf-transform/core
npm run typecheck
```
- **Expected:** both install; `package.json` deps updated; typecheck still clean.
- **Most likely failure:** peer-dep or ESM/CJS complaint from `@gltf-transform/core`, or a Fastify 5 vs multipart major-version mismatch.
  - **Cause:** version skew — the repo is Fastify 5, `@fastify/multipart` must be its v9+ line.
  - **Counter-move:** pin `@fastify/multipart@^9`; `@gltf-transform/core` is ESM-native and the repo is `"type": "module"`, so imports should be plain. If a subpath import fails, import from the package root only.
- **Fork — trigger:** `@gltf-transform/core` won't import under this Node/ESM setup after 10 min → **RECON NEEDED R1** (settle with the one-liner in the RECON table); as a fallback the GLB writer can be hand-rolled (a glTF 2.0 GLB is a JSON chunk + BIN chunk with an 8-byte header — ~60 lines), but try the library first.

### Move 2 — `AssetStore` interface + `LocalAssetStore` (no routes yet)
Create `src/assets/store.ts`: `interface AssetStore { put(data, meta) → assetUri; get(assetUri) → stream/buffer; stat(assetUri) }` and `class LocalAssetStore` writing under `OMNI3D_DATA_DIR` (default `./data/assets`). Add a Zod schema for the upload/download response shapes in `src/schemas/` and wire it into `export:schema` if it's a stored contract.
- **Expected:** `npm run typecheck` clean; a tiny inline check (temp script or node -e) round-trips a buffer: `put` → `get` returns identical bytes; `stat` reports size.
- **Most likely failure:** path handling — `asset://uploads/<uuid>.png` must map to a filesystem path **inside** the data dir and nowhere else.
  - **Cause:** naive string concat lets `..` escape.
  - **Counter-move:** resolve with `path.resolve(dataDir, safeRelative)` then assert the result `startsWith(path.resolve(dataDir))`; reject otherwise. This is the traversal guard the negative test (Move 5) will hammer — build it here, not later.
- **Fork — trigger:** you're tempted to let `put` take a raw path from the caller → **stop**; `put` mints the URI, callers never choose the path. That inversion is what makes the store swappable and safe.

### Move 3 — Upload + download routes
In `src/app.ts` (via `buildApp`, passing the `AssetStore` in — extend the factory signature; update `server.ts` to construct and pass a `LocalAssetStore`): register `@fastify/multipart`; add `POST /assets` (validate content-type ∈ {png,jpg,webp,mp4,mov,wav}, enforce `OMNI3D_MAX_UPLOAD_MB` default 200 → 413 on exceed) → `201 { uri }`; add `GET /assets/*` streaming with correct content-type, 404 for unknown, traversal-safe.
- **Expected:** `curl -F file=@some.png localhost:8787/assets` → `201` + `asset://uploads/<uuid>.png`; `GET /assets/uploads/<uuid>.png` streams the bytes back with `image/png`.
- **Most likely failure:** ① `buildApp`'s new 3rd/param breaks the many callers (smokes, `pipeline-real`, `server.ts`) that call `buildApp(store, bus)`. ② multipart body not consumed → hangs.
  - **Cause:** signature change ripples; or the file stream isn't awaited/piped.
  - **Counter-move:** make the `AssetStore` param **optional with a default** (`buildApp(store, bus, assets = new LocalAssetStore())`) so existing 2-arg callers keep compiling — verify with `grep -rn "buildApp(" src/`. For multipart, `await req.file()` and pipe to `assets.put`; never leave the stream unconsumed.
- **Fork — trigger:** if `grep buildApp(` shows callers you can't safely default → add the param but update every caller in the same commit; run `npm run check` immediately to catch breakage.

### Move 4 — Pipeline writes a real `.glb`
Make stage A3 (retopo) and stage C (final) serialize their `Mesh` to a binary `.glb` via `@gltf-transform/core` and register it in the `AssetStore`; the job manifest's `asset://…` for those artifacts now resolves through `GET /assets/*`. Keep the synthetic (non-real) path emitting the same URI *shape* so existing smokes don't change meaning.
- **Expected:** after `npm run pipeline:real`, the final artifact URI resolves; `curl -o out.glb localhost:8787/assets/<final>` yields a file whose **first 4 bytes are `glTF`** (0x67 0x6C 0x54 0x46); `npx @gltf-transform/cli validate out.glb` → no errors.
- **Most likely failure:** ① `@gltf-transform` accessor/buffer wiring produces an invalid GLB (indices as the wrong component type, positions not `VEC3`/`FLOAT`). ② WASM/async init ordering. ③ you accidentally changed A3's emitted **payload numbers** and broke `smoke:retopo`/`smoke:e2e`.
  - **Cause:** glTF requires `indices` as UNSIGNED_INT (matches `Uint32Array` — good) and `POSITION` as VEC3 FLOAT (matches `Float32Array` flat xyz — good), plus a min/max on the POSITION accessor or some validators warn.
  - **Counter-move:** compute POSITION min/max; set indices accessor to `UNSIGNED_INT`; write with the Document→NodeIO/GLB path. If a validator warns on missing min/max, add them. Run `smoke:retopo` and `smoke:e2e` right after — if either goes red, you altered stage output; revert the payload change and serialize as a **side effect** (write the glb, keep the emitted numbers identical).
- **Fork — trigger:**
  - GLB invalid per `gltf-transform validate` → fix accessor types/min-max; re-validate. Don't ship an unvalidated glb.
  - `smoke:retopo`/`smoke:e2e` red → you changed behavior → narrow to side-effect-only (Move 6 rule).
  - `@gltf-transform` still won't produce a valid GLB after 20 min → fall back to the ~60-line hand-rolled GLB writer (RECON R1 note), still validated the same way.

### Move 5 — The `smoke:assets` script (+ negative tests) and wire into `check`
Write `src/smoke-assets.ts`: (1) start app with a `LocalAssetStore` in a temp dir; (2) upload a real png → 201 + uri; (3) run a job to completion; (4) download the final glb → assert `glTF` magic + non-zero size; (5) **negative:** `GET /assets/..%2f..%2f..%2fetc%2fpasswd` and raw `../` variants → 404, never file contents; (6) **negative:** upload over the size cap → 413; (7) upload a disallowed content-type → 400. Add `"smoke:assets": "tsx src/smoke-assets.ts"` and append it to the `check` chain in `package.json`. Clean up the temp dir at the end.
- **Expected:** `npm run smoke:assets` prints `✓` lines + `ASSETS SMOKE PASS`; `npm run check` still ends `PASS` with the new smoke included.
- **Most likely failure:** temp-dir/CRLF/Windows path issues, or the traversal probe returns 200 (guard is weak).
  - **Cause:** Windows path separators, or the guard checks the URL string not the resolved fs path.
  - **Counter-move:** use `os.tmpdir()` + `fs.mkdtemp`; guard on the **resolved** path (`startsWith(resolve(dataDir))`), which is separator-correct via `node:path`. If traversal returns 200 → the guard is bypassed → **this is exactly the bug the test exists to catch**; fix the store, not the test.
- **Fork — trigger:** traversal test can't be made to 404 without also blocking legit nested uploads → re-examine the guard (you likely compared strings before resolving); never relax the test to pass.

### Move 6 — Green-up rule (applies whenever an existing smoke breaks)
If any pre-existing smoke goes red at any move: your change altered observable pipeline behavior. Revert to a **side-effect-only** shape — write files/register URIs without changing emitted payload numbers or event shapes. Existing smokes assert the scaffold's contract; WO-01 adds I/O *around* it, not *through* it.
- **Expected after any fix:** `npm run check` green, all 11 original smokes + `smoke:assets`.

---

## RECON NEEDED — settle before acting

| # | Assumption | Exact check |
|---|---|---|
| R1 | `@gltf-transform/core` imports & writes a valid GLB under this Node 20+/ESM repo | `node --input-type=module -e "import {Document,NodeIO} from '@gltf-transform/core'; console.log(typeof Document, typeof NodeIO)"` → both `function`. If it throws, use the hand-rolled GLB writer fallback. |
| R2 | `@fastify/multipart` v9 matches Fastify 5 | After install, `npm run typecheck` clean and `app.register` of multipart doesn't throw at boot (`npm start` prints the listening line). |
| R3 | `buildApp` callers can take an optional new param without edits | `grep -rn "buildApp(" src/` — count call sites; all pass 2 args → optional-default is safe. |
| R4 | Serializing A3/C mesh doesn't change emitted stage numbers | Run `smoke:retopo` + `smoke:e2e` before and after Move 4 — identical `✓` output. |
| R5 | The final glb is actually valid, not just present | `npx @gltf-transform/cli validate out.glb` → 0 errors (add to smoke if CLI is available; else assert `glTF` magic + parse via NodeIO). |

## Abort conditions

- **A1:** Baseline `npm run check` can't be made green (Move 0).
- **A2:** A change forces editing/deleting an existing smoke to stay green and you can't confirm from HANDOFF/docs that the smoke asserted intended behavior — escalate (spec question for owner).
- **A3:** Neither `@gltf-transform` nor a hand-rolled writer yields a validator-clean GLB in the time budget — commit the AssetStore + routes + upload/download (already useful), mark the glb-serialization sub-task RECON-NEEDED, push WIP, stop.
- **A4:** The upload/multipart layer needs a config/secret not available — scope to local disk only, note the gap.
- **A5:** Time/budget cap — commit what's green (with its smoke), ledger the proven-vs-open split, push WIP, stop.

## Verification runs the executor MUST perform (definition of done)

1. `npm run check` → **Pass =** `PASS`, all 11 original smokes ✓ **and** `ASSETS SMOKE PASS`.
2. `npm run pipeline:real` → **Pass =** `status: passed`, 6 stages, EITL `E=0` (unchanged — your I/O must not alter geometry output).
3. Manual round-trip (paste output):
   ```bash
   npm start &                                  # or PORT=8787 npm start
   curl -s -F file=@<any .png> localhost:8787/assets      # → 201 + asset://uploads/<uuid>.png
   curl -s -o out.glb localhost:8787/assets/<final-glb-uri-path>
   head -c 4 out.glb | xxd                       # → 67 6c 54 46  (glTF)
   npx @gltf-transform/cli validate out.glb      # → no errors
   curl -s -o /dev/null -w "%{http_code}" 'localhost:8787/assets/..%2f..%2fpackage.json'  # → 404
   ```
4. `npm run typecheck` → no errors; `grep -rn "as any\|@ts-ignore" src/assets src/app.ts` → no new suppressions introduced by your change.
5. Ledger: `docs/plan/BUILD_LEDGER.md` has a WO-01 entry (STARTED→LANDED/WIP) citing what's proven (commands + results) and any RECON/ABORT outcome; WO-01 status-board row updated.

**PR ready only when 1–5 pass.** Partial-but-honest (AssetStore + routes landed, glb serialization RECON-NEEDED) is a valid outcome — ship what's proven, never fake a passing glb.
