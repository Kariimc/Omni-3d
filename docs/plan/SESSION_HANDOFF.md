# SESSION HANDOFF — read this first next session

> Written 2026-07-06 for the next agent/session. Everything below is verified. Nothing
> is in flight — the tree is clean and pushed. You are picking up a finished planning
> phase; the next work is either (a) start building WO-01, or (b) run Wargame 07, or
> (c) whatever the owner asks. This tells you exactly where everything is.

## 30-second status

- **Repo:** `C:\Users\Kariim\Desktop\Omni-3d` (also cloned; GitHub `Kariimc/Omni-3d`).
- **Branch:** `plan/higgsfield-competitor` — **clean, fully pushed**, nothing uncommitted.
- **PR:** [#2](https://github.com/Kariimc/Omni-3d/pull/2) OPEN (draft), docs-only, not merged. Owner gates the merge — do NOT merge to main without a yes.
- **Baseline:** GREEN. `npm install && npm run check` = typecheck + validate + 11 smokes pass; `npm run pipeline:real` → `status: passed`.
- **Desktop mirror:** `C:\Users\Kariim\Desktop\Omni3D-Plan\` holds a copy of everything in `docs/plan/` + `wargames/` + `PROGRESS.md`. Refresh it after any plan change (command in §6).

## What happened across the last sessions (context so you don't re-ask)

The goal: turn Omni 3D (the owner's video→game-ready-3D pipeline) into a **competitor to Higgsfield AI**, adding the top features that platform's community wishes it had. Over several sessions we:
1. Deep-researched Higgsfield (features, pricing, ~$500M revenue, and the community's biggest complaints — fake "unlimited", billing dark patterns, credit expiry, no 3D). → `docs/plan/RESEARCH_HIGGSFIELD.md`.
2. Wrote the strategy + roadmap. → `docs/plan/MASTER_PLAN.md`.
3. Wrote 14, then 18, self-contained **work orders** for builder agents. → `docs/plan/work-orders/WO-01..WO-18`.
4. Wrote a **builder handoff** (verified baseline, repo contracts, gotchas) + an append-only **build ledger**. → `HANDOFF.md`, `BUILD_LEDGER.md`.
5. **Bulletproofed** it: adversarial self-review, a site spec to beat higgsfield.ai, a measurable quality bar, and 4 operational WOs (deploy, marketing site, quality gate, safety/legal). → `SITE_SPEC.md`, `QUALITY_BAR.md`, `PLAN_REVIEW.md`.
6. Wrote two **wargames** (battle plans for a cheaper executor to run): `wargames/07-bugs.md` (bug hunt) and `wargames/08-wo01-file-io.md` (executing WO-01, the first build).

All of that is committed and pushed. Nothing is half-done.

## The document map (what to read, in order)

For **building a feature**: `docs/plan/HANDOFF.md` (contracts, baseline, gotchas) → your `work-orders/WO-NN-*.md` → `BUILD_LEDGER.md` (what changed since). UI/site WOs also read `SITE_SPEC.md` + `QUALITY_BAR.md`; if you hit a risk, the fallback is in `PLAN_REVIEW.md` §2.

For **the "why"**: `MASTER_PLAN.md` → `RESEARCH_HIGGSFIELD.md`.

For **hunting bugs**: `wargames/07-bugs.md` (fully self-contained, runs without questions).

| File | What it is |
|---|---|
| `docs/plan/MASTER_PLAN.md` | Strategy, top-10 wished features → WO map, roadmap, phases |
| `docs/plan/RESEARCH_HIGGSFIELD.md` | Sourced research: Part 1 product/pricing/traction, Part 2 community complaints |
| `docs/plan/SITE_SPEC.md` | The site that beats higgsfield.ai: IA, landing, workspace UX, Studio Dark design |
| `docs/plan/QUALITY_BAR.md` | Measurable release budgets + beats-Higgsfield head-to-head table (WO-17 enforces) |
| `docs/plan/PLAN_REVIEW.md` | Adversarial pass: contract fixes, 10-risk register w/ mandated fallbacks |
| `docs/plan/HANDOFF.md` | **Builder bible**: verified baseline, repo map, schema system, the 2 core seams, integration table, gotchas |
| `docs/plan/BUILD_LEDGER.md` | Append-only running memory + WO status board (all 18 = "not started") |
| `docs/plan/work-orders/README.md` | WO index, dependency graph, per-WO protocol |
| `docs/plan/work-orders/WO-01..18` | Self-contained build specs, each with acceptance commands |
| `wargames/07-bugs.md` | Bug-hunt battle plan for a cheaper executor |
| `PROGRESS.md` (repo root) | Live one-screen state |

## The codebase in five facts (from verified recon)

1. TypeScript + Fastify 5 + Zod, run via `tsx` — **no build step**, no unit-test framework (tests are bespoke `src/smoke-*.ts` scripts chained by `npm run check`).
2. Core flow: `POST /pipeline` → `buildJobEnvelope` (`src/schemas/request.ts`) → `POST /jobs/:id/advance` → `advanceJob` (`src/loops/runner.ts`) runs one stage of `STAGE_PLAN` A1→A2→A3→B1→B2→C → persists stage + appends/publishes `LiveEvent`s → `/live` WebSocket replays then streams.
3. **The key seam:** `advanceJob(job, opts, overrides)`'s 3rd arg swaps synthetic generators for real providers per stage — this is how `features.realPipeline` works and where new stage logic plugs in.
4. **The scaffold boundary (NOT bugs — documented):** artifacts are `asset://` manifest URIs, not real files; the "real" providers run real algorithms on **procedurally generated inputs** (`buildStageContext()` in `src/loops/real-providers.ts`), so uploaded media never reaches the pipeline. Closing that seam is WO-01/WO-02's job.
5. `public/` already serves a live dashboard at `/` — don't break it (earlier plan text wrongly said "no UI"; corrected in HANDOFF §3).

## Where to start (pick based on what the owner wants)

- **"Start building"** → WO-01 (real file I/O) is the unblocker; then WO-02 and WO-03 in parallel; deploy WO-15 as soon as WO-03 lands. Critical path: WO-01 → WO-02/03 → WO-04 → WO-09 → WO-11 → WO-17. Follow `work-orders/README.md` protocol: branch `wo/NN-slug`, log `STARTED` in the ledger, build to spec, paste acceptance output in a draft PR, never merge to main.
- **"Build WO-01"** → execute `wargames/08-wo01-file-io.md` verbatim (branch `wo/01-real-file-io`). It wargames the whole WO-01 build move by move — the recommended first build.
- **"Run the bug hunt"** → execute `wargames/07-bugs.md` verbatim (branch `wargame/07-bugs`). It's written to run end-to-end without questions.
- **"Change the plan"** → edit under `docs/plan/`, keep the ledger + this file current, refresh the Desktop mirror.

## Guardrails that carry across sessions

- Merge to `master`/`main` needs the owner's explicit yes (one gate). Everything else — branch, commit, draft PR, CI — is yours to run.
- Keep `npm run check` green; never weaken a smoke to pass. Every new feature extends the check chain with its own smoke.
- Contracts owned by other WOs (HANDOFF §9): code against their spec, don't fork a second version.
- Log discoveries in `BUILD_LEDGER.md` (append-only) — that file is how the *next* next-session doesn't lose your findings.
- Windows dev box: Git Bash + PowerShell; watch CRLF warnings (harmless, don't "fix" line endings). Python engine (WO-02) currently lives outside the repo at `~/.claude/skills/omni3d/engine/`.

## Exact commands to re-orient (run these first next session)

```bash
cd /c/Users/Kariim/Desktop/Omni-3d
git status && git branch --show-current      # expect: clean, plan/higgsfield-competitor
git log --oneline -6                          # top: 9aed8a8 Wargame 07…
npm install && npm run check                  # expect: PASS, 11 smokes green
gh pr view 2 --json state,url                 # expect: OPEN, PR #2
```
If `npm run check` is not green, STOP and fix the environment before anything else — a red baseline invalidates all downstream work (see wargame Move 0 for the drill).

## Open threads / nothing-is-blocked

- No code has been written yet — this is a **planning + wargame** deliverable. All 18 WOs are "not started" on the ledger board.
- Two critique subagents (adversarial review, site-design) hit the session usage limit last session and returned nothing; their work was done inline instead — so there's no pending subagent to resume, and nothing was lost.
- The MCP servers listed as "require authentication" are not needed for this work; ignore unless the owner asks to use one (they'd authorize via claude.ai connector settings or `claude mcp` in an interactive session — not possible non-interactively).
