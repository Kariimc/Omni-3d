# BUILD LEDGER — append-only running memory of the build

> Every builder agent appends here. Never rewrite or delete old entries (fix errors by
> appending a correction). Newest entries at the BOTTOM. This file is how knowledge
> survives agent and session boundaries — when in doubt, write it down.

## Entry format (copy this)

```
### [WO-NN] <short title> — <STATUS> — <date>
- Agent/session: <who or which session>
- Branch/PR: wo/NN-slug · <PR url or "not opened yet">
- Done: <what is actually built & verified — cite the command + result>
- Discovered: <anything the next agent must know: quirks, decisions, drift>
- Next: <the exact next action if unfinished>
- BLOCKED-ON: <WO-NN / credentials / owner decision — omit if not blocked>
```
STATUS ∈ `STARTED | WIP | BLOCKED | IN-REVIEW | LANDED | CORRECTION`

## WO status board (edit this table in place — the one exception to append-only)

| WO | Status | Branch | PR |
|----|--------|--------|----|
| 01 real file I/O | IN-REVIEW | wo/01-real-file-io | draft PR |
| 02 engine bridge | not started | — | — |
| 03 job queue | not started | — | — |
| 04 web workspace | not started | — | — |
| 05 auth + projects | not started | — | — |
| 06 cost meter | not started | — | — |
| 07 model gateway | not started | — | — |
| 08 camera presets | not started | — | — |
| 09 character anchor | not started | — | — |
| 10 audio + lipsync | not started | — | — |
| 11 timeline editor | not started | — | — |
| 12 4K output | not started | — | — |
| 13 pro export + API | not started | — | — |
| 14 honest billing | not started | — | — |
| 15 deploy + ops | not started | — | — |
| 16 marketing site | not started | — | — |
| 17 quality gate | not started | — | — |
| 18 safety + legal | not started | — | — |

---

### [PLAN] Plan + handoff authored — LANDED — 2026-07-05
- Agent/session: planning session (Claude, with two deep-research subagents on Higgsfield)
- Branch/PR: plan/higgsfield-competitor · https://github.com/Kariimc/Omni-3d/pull/2 (draft)
- Done: research (RESEARCH_HIGGSFIELD.md), strategy (MASTER_PLAN.md), 14 work orders,
  HANDOFF.md, this ledger. Baseline verified green on the owner's Windows 11 box:
  `npm install` + `npm run check` → all 11 smokes pass; `pipeline:real` → status passed
  (A1 kept 2/4 frames | A2 3415 voxels | A3 20480→10000 tris | C E=0).
- Discovered:
  - `public/` already serves a live dashboard at `/` — earlier plan text saying "no UI"
    is wrong; HANDOFF §3 corrects it. WO-04 must not break `/` until deliberate.
  - The "real pipeline" runs real algorithms on PROCEDURAL inputs — `buildStageContext()`
    in `src/loops/real-providers.ts` fabricates frames/mesh/motion. Uploaded media never
    reaches the pipeline. This is THE seam for WO-01/02 (HANDOFF §6).
  - Python engine lives OUTSIDE this repo at `~/.claude/skills/omni3d/engine/` on the
    owner's machine — WO-02 copies it in. If building WO-02 from a different machine,
    ask the owner for that folder or pull it from the omni3d skill.
  - `advanceJob`'s third arg (per-stage overrides) is the DI seam everything plugs into.
  - Jimp v1 + meshoptimizer-WASM API quirks: see HANDOFF §12.
- Next: start WO-01 (real file I/O). WO-02 and WO-03 may start in parallel after WO-01's
  AssetStore interface merges (or code against its spec and rebase).

### [WO-01] Real file I/O built (wargame 08 executed) — IN-REVIEW — 2026-07-06
- Agent/session: executor session (ran wargames/08-wo01-file-io.md move by move)
- Branch/PR: wo/01-real-file-io · draft PR (see below), based on plan/higgsfield-competitor
- Done (all verified, commands pasted in PR):
  - `src/assets/store.ts`: `AssetStore` interface + `LocalAssetStore` (mints asset:// URIs,
    traversal-safe via resolve+startsWith on the RESOLVED path). `src/assets/glb.ts`: mesh→
    binary .glb via @gltf-transform/core.
  - `src/app.ts`: `buildApp` gained optional `assets` param (3rd, defaulted — existing 2-arg
    callers untouched); `POST /assets` (multipart, type allow-list, size cap→413) and
    `GET /assets/*` (streamed, 404 traversal-safe).
  - `runRealPipeline(job, ctx, assets?)`: on a passing REAL run, serializes the decimated mesh
    to a real .glb as a SIDE EFFECT and points artifacts.retopoMesh at the stored file. Emitted
    stage payloads unchanged (smoke:retopo + smoke:e2e stayed green → R4 satisfied).
  - `src/smoke-assets.ts` wired into `npm run check` (10 assertions incl. traversal/oversize/
    bad-type negatives). `data/` gitignored. Deps added: @fastify/multipart@10, @gltf-transform/core.
- Verified: `npm run check` green (12 pass lines); `pipeline:real` → status passed, EITL 0,
  6 stages (unchanged); manual HTTP round-trip 201/identical-bytes/400/404/alive; downloaded
  glb magic `glTF` + `gltf-transform validate` → 0 errors 0 warnings.
- Discovered (carry forward):
  - **Windows curl gotcha:** `curl -F file=@/tmp/x` fails with error 26 (Win curl.exe can't read
    MSYS /tmp paths) → looks like HTTP 000 / a server crash but is client-side. Use a repo-relative
    file path for manual curl tests. Cost real debugging time — logged so the next agent skips it.
  - @fastify/multipart is **v10** (not v9 as the wargame guessed) — imports clean under Fastify 5.
  - @gltf-transform/core writes a validator-clean GLB from Float32 positions + Uint32 indices
    with no min/max needed for `validate` to pass — the hand-rolled fallback was NOT required.
  - The unconsumed-multipart-stream-hangs risk (wargame Move 3 ②) did NOT bite; watched for it, clean.
- Next: owner merge decision on this PR. Then WO-02/WO-03 can start (WO-01's AssetStore contract
  is now real). WO-03 still carries the concurrency-race canary (smoke:race) from wargame 07.

### [WARGAME] Wargames 07 + 08 written; intel indexed — LANDED — 2026-07-06
- Agent/session: planning session (Claude), after read-only recon of the full pipeline
- Branch/PR: plan/higgsfield-competitor · PR #2 (draft)
- Done: `wargames/07-bugs.md` (bug-hunt battle plan), `wargames/08-wo01-file-io.md` (WO-01
  build battle plan), and `wargames/README.md` (index + carried intel — verified repo facts,
  DI/factory seams, scaffold boundary, bug-suspect verdicts, WO-01 traps + fallbacks). Wired
  the index into SESSION_HANDOFF.md and HANDOFF.md so no builder/debugger misses it.
- Discovered (now carried in wargames/README.md so it's not lost):
  - Bug suspects are HYPOTHESES, not confirmed. Best guesses from recon: #1 concurrent-advance
    race is the real one (but maybe only on the Supabase store); #2 store-wide seq and #5
    engine:"both" collapse are likely NOT-A-BUG; #3/#4 minor. Executor must PROVE before fixing.
  - WO-01 specifics verified: no multipart/gltf deps yet; `Mesh` type at retopology.ts:5-8 is
    what serializes to .glb; `buildApp` new params must be optional-default (grep callers first).
- Next: unchanged — run wargame 08 (build WO-01) or 07 (bug hunt), or keep planning. Neither
  wargame executed yet; no product code exists.

### [PLAN] Bulletproofing pass: site spec, quality bar, adversarial review, WO-15..18 — LANDED — 2026-07-06
- Agent/session: planning session (Claude; two critique subagents hit session limits, so the
  adversarial review + site spec were done inline against the full research and codebase context)
- Branch/PR: plan/higgsfield-competitor · https://github.com/Kariimc/Omni-3d/pull/2 (draft)
- Done: SITE_SPEC.md (IA, landing spec, workspace UX rules, Studio Dark design direction),
  QUALITY_BAR.md (measurable release budgets + beats-Higgsfield head-to-head table),
  PLAN_REVIEW.md (contract fixes, 10-risk register with mandated fallbacks, acceptance
  hardening), new WO-15 (deploy/CI/status), WO-16 (design system + marketing site),
  WO-17 (quality gate as CI), WO-18 (safety + legal). Amended WO-01/03/04/05/08/12 with
  the review's fixes (pg-boss direct connection, service-key-bypasses-RLS, SwiftShader
  fallback, tokens contract, negative tests, tile-render fallback).
- Discovered:
  - Supabase SERVICE key bypasses RLS — API-layer ownership checks are the real mechanism
    (now in WO-05). Anyone touching Supabase reads must know this.
  - pg-boss cannot run over PgBouncer transaction pooling — use the direct connection string.
  - Design decision recorded: Studio Dark direction (SITE_SPEC §5), rejected alternatives
    documented so agents don't relitigate.
- Next: unchanged — start WO-01; also start WO-15 as soon as WO-03 lands (deploy early so
  every later WO verifies against a real environment).
