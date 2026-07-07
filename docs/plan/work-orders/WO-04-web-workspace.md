# WO-04 — Web workspace v1: upload → watch pipeline → view 3D → download

**Phase 1 · depends on WO-01..03 · branch `wo/04-web-workspace`**

## Goal
A browser UI where a non-technical user uploads an image/video (or types a prompt), watches the 6 stages run live, orbits the resulting 3D model in a viewer, and downloads the `.glb`.

## Why
Higgsfield's most-praised trait is ease of use; Omni 3D currently has zero UI. This is the face of the product.

## Read first
- `docs/ui/WORKSPACE_WIREFRAME.md` — the intended layout; follow it unless it contradicts this WO.
- API surfaces from WO-01 (`/assets`), WO-03 (`/pipeline`, `/jobs/:id/events` SSE, `/queue/status`), `docs/payloads/pipeline.job.json` (job payload shape).

## Spec
1. **Stack**: Vite + React + TypeScript in `web/` (keep the repo no-build-server philosophy: `npm run dev` proxies to the Fastify API; `npm run build` outputs static files served by Fastify at `/app`). Three.js via `@react-three/fiber` + `@react-three/drei` for the GLB viewer.
   **Design contract (PLAN_REVIEW §1):** all styling consumes `design/tokens.css` (WO-16's contract — Studio Dark, see ../SITE_SPEC.md §5). If WO-16 hasn't landed, create `design/tokens.css` yourself as a minimal stub following SITE_SPEC §5 and note it in the ledger — never invent a second palette. UX principles in SITE_SPEC §4 are requirements (cost-on-button, honest queue chip, sticky toggles, modes-not-apps).
2. **Screens**:
   - **New job**: drag-drop upload (image/video) or text prompt; target selector (UE5 / Unity / generic glTF); poly budget (hero/prop/background); "Run" button. Shows queue depth from `/queue/status` BEFORE submitting (honest-queue principle).
   - **Job view**: 6-stage progress rail driven by the SSE stream (stage names in plain words: "Sampling frames… Carving shape… Cleaning geometry… Building skeleton… Copying motion… Engine checks"); live log line per event; error state shows the refund note ("This run failed — nothing was charged").
   - **Result**: orbitable GLB viewer (grid floor, wireframe toggle, bone display if rigged), Download `.glb` button, "raw manifest" collapsible for power users.
3. **State**: plain fetch + EventSource; no state library unless genuinely needed.
4. Root `package.json` scripts: `web:dev`, `web:build`; `npm run check` gains `web:typecheck`.

## Allowed new dependencies (web/ only)
`react`, `react-dom`, `three`, `@react-three/fiber`, `@react-three/drei`, `vite` + plugins.

## Acceptance
```bash
npm run check                    # includes web typecheck, green
npm run dev & npm run web:dev    # then, in a browser (paste screenshots or DOM-verified steps):
# 1. upload sample image → job starts → all 6 stages animate via SSE
# 2. result renders in the 3D viewer and Download saves a valid .glb
npm run web:build && npm start   # /app serves the built UI
```
Verification must be a scripted Playwright run with screenshots attached to the PR (PLAN_REVIEW §3) — not manual clicking. Exit criterion: once the workspace covers the old dashboard's functionality, `/` redirects to `/app` (until then, leave `public/` untouched).

## Out of scope
Auth (WO-05), cost meter UI (WO-06), timeline (WO-11), mobile layout polish.
