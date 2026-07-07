# SESSION HANDOFF — read this first next session

> Updated 2026-07-06. Planning is done AND the first two wargames have been executed
> (two feature branches with draft PRs). The next work is either (a) run Wargame 09
> (build WO-03, the durable queue), (b) merge the open PRs, or (c) whatever the owner asks.

## 30-second status

- **Repo:** `C:\Users\Kariim\Desktop\Omni-3d` (also cloned; GitHub `Kariimc/Omni-3d`).
- **Branch:** `plan/higgsfield-competitor` — clean, fully pushed. Feature branches: `wargame/07-bugs` (PR #3), `wo/01-real-file-io` (PR #4).
- **Open draft PRs (owner gates every merge — do NOT merge without a yes):**
  - [#2](https://github.com/Kariimc/Omni-3d/pull/2) — the plan (docs only)
  - [#3](https://github.com/Kariimc/Omni-3d/pull/3) — Wargame 07 fix: silent `/live` replay failure now surfaced as an error event (+ `smoke:race`, `smoke:live-replay`)
  - [#4](https://github.com/Kariimc/Omni-3d/pull/4) — WO-01: real file I/O (uploads + downloadable, validator-clean `.glb`)
- **Baseline:** GREEN on the plan branch. `npm install && npm run check` → 12 smoke suites pass; `npm run pipeline:real` → `status: passed`. (PR #3 = 14 smokes, PR #4 = 13 smokes on their branches.)
- **Wargames:** `wargames/README.md` indexes all three; 07 & 08 RAN (PRs #3/#4), 09 (WO-03 queue) is written and ready to run.
- **Desktop mirror:** `C:\Users\Kariim\Desktop\Omni3D-Plan\` copies `docs/plan/` + `wargames/` + `PROGRESS.md`. Refresh after any plan change.

## What happened across the last sessions (context so you don't re-ask)

The goal: turn Omni 3D (the owner's video→game-ready-3D pipeline) into a **competitor to Higgsfield AI**, adding the top features that platform's community wishes it had. Over several sessions we:
1. Deep-researched Higgsfield (features, pricing, ~$500M revenue, and the community's biggest complaints — fake "unlimited", billing dark patterns, credit expiry, no 3D). → `docs/plan/RESEARCH_HIGGSFIELD.md`.
2. Wrote the strategy + roadmap. → `docs/plan/MASTER_PLAN.md`.
3. Wrote 14, then 18, self-contained **work orders** for builder agents. → `docs/plan/work-orders/WO-01..WO-18`.
4. Wrote a **builder handoff** (verified baseline, repo contracts, gotchas) + an append-only **build ledger**. → `HANDOFF.md`, `BUILD_LEDGER.md`.
5. **Bulletproofed** it: adversarial self-review, a site spec to beat higgsfield.ai, a measurable quality bar, and 4 operational WOs (deploy, marketing site, quality gate, safety/legal). → `SITE_SPEC.md`, `QUALITY_BAR.md`, `PLAN_REVIEW.md`.
6. Wrote three **wargames** and EXECUTED two: `wargames/07-bugs.md` (bug hunt → RAN, fixed a real silent-failure defect, PR #3), `wargames/08-wo01-file-io.md` (WO-01 → RAN, built real file I/O, PR #4), and `wargames/09-wo03-job-queue.md` (WO-03 durable queue → written, ready to run).

All of that is committed and pushed. Nothing is half-done — the two executed wargames are on their own branches as draft PRs awaiting the owner's merge call.

## The document map (what to read, in order)

For **building a feature**: `docs/plan/HANDOFF.md` (contracts, baseline, gotchas) → your `work-orders/WO-NN-*.md` → `BUILD_LEDGER.md` (what changed since). UI/site WOs also read `SITE_SPEC.md` + `QUALITY_BAR.md`; if you hit a risk, the fallback is in `PLAN_REVIEW.md` §2.

For **the "why"**: `MASTER_PLAN.md` → `RESEARCH_HIGGSFIELD.md`.

For **building or debugging any `src/` code**: start at `wargames/README.md` — it indexes both wargames AND carries the verified repo intel/verdicts they surfaced (baseline facts, the DI/factory seams, the scaffold boundary, bug-hunt suspect statuses, WO-01 build traps + fallbacks). Read it before the specific wargame so you inherit the findings without re-deriving them.

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
| `wargames/README.md` | **Wargame index + carried intel** — verified repo facts, seams, bug-suspect verdicts, WO-01 traps. Read before building/debugging `src/` |
| `wargames/07-bugs.md` | Bug-hunt battle plan for a cheaper executor |
| `wargames/08-wo01-file-io.md` | WO-01 (real file I/O) build battle plan |
| `PROGRESS.md` (repo root) | Live one-screen state |

## The codebase in five facts (from verified recon)

1. TypeScript + Fastify 5 + Zod, run via `tsx` — **no build step**, no unit-test framework (tests are bespoke `src/smoke-*.ts` scripts chained by `npm run check`).
2. Core flow: `POST /pipeline` → `buildJobEnvelope` (`src/schemas/request.ts`) → `POST /jobs/:id/advance` → `advanceJob` (`src/loops/runner.ts`) runs one stage of `STAGE_PLAN` A1→A2→A3→B1→B2→C → persists stage + appends/publishes `LiveEvent`s → `/live` WebSocket replays then streams.
3. **The key seam:** `advanceJob(job, opts, overrides)`'s 3rd arg swaps synthetic generators for real providers per stage — this is how `features.realPipeline` works and where new stage logic plugs in.
4. **The scaffold boundary (NOT bugs — documented):** artifacts are `asset://` manifest URIs, not real files; the "real" providers run real algorithms on **procedurally generated inputs** (`buildStageContext()` in `src/loops/real-providers.ts`), so uploaded media never reaches the pipeline. Closing that seam is WO-01/WO-02's job.
5. `public/` already serves a live dashboard at `/` — don't break it (earlier plan text wrongly said "no UI"; corrected in HANDOFF §3).

## Where to start (pick based on what the owner wants)

- **"Run the next wargame" / "keep building"** → execute `wargames/09-wo03-job-queue.md` verbatim (branch `wo/03-job-queue` off the plan branch). It's the durable-queue build, written move-by-move to run without questions. **Recommended next.**
- **"Merge the work"** → PRs #3 (bug fix) and #4 (WO-01) are green draft PRs based on the plan branch; owner decides merge order. (They don't conflict — #3 touches `app.ts` `/live`, #4 adds `src/assets/` + `/assets` routes.)
- **"Build WO-02"** → the engine bridge; note the Python engine lives OUTSIDE the repo at `~/.claude/skills/omni3d/engine/` — WO-02 copies it in. No wargame written for it yet.
- **"Change the plan"** → edit under `docs/plan/`, keep the ledger + this file current, refresh the Desktop mirror.

Critical path: WO-01 ✅ → **WO-02/03** → WO-04 → WO-09 → WO-11 → WO-17. Follow `work-orders/README.md` protocol: branch `wo/NN-slug`, log `STARTED` in the ledger, build to spec, paste acceptance output in a draft PR, never merge to main.

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
git log --oneline -6
npm install && npm run check                  # expect: PASS, 12 smokes green on the plan branch
gh pr list --state open                       # expect: PRs #2, #3, #4 (all draft)
```
If `npm run check` is not green, STOP and fix the environment before anything else — a red baseline invalidates all downstream work (see any wargame's Move 0 for the drill).

## Open threads / nothing-is-blocked

- **First code has landed** on two feature branches: WO-01 (real file I/O, PR #4) and the wargame-07 fix (PR #3). WO-01 is `IN-REVIEW` on the ledger board; the other 17 WOs are "not started". Both PRs are green and await the owner's merge call.
- **WO-03 carries one live finding to prove:** the concurrency race (wargame 07 suspect #2) wasn't reproducible on the in-memory store but is flagged for the Supabase store — WO-03's single-worker queue structurally fixes it. The `smoke:race` canary lives on the `wargame/07-bugs` branch (PR #3), so it won't be on the WO-03 branch unless #3 merges first. Wargame 09 notes this.
- Two critique subagents (adversarial review, site-design) hit the session usage limit an earlier session and returned nothing; their work was done inline instead — no pending subagent, nothing lost.
- The MCP servers listed as "require authentication" are not needed for this work; ignore unless the owner asks to use one (they'd authorize via claude.ai connector settings or `claude mcp` in an interactive session — not possible non-interactively).
