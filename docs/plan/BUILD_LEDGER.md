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
| 01 real file I/O | not started | — | — |
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
