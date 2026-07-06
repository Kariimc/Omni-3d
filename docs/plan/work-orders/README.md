# Work orders — how to build the Higgsfield-competitor plan

Each `WO-*.md` file is a **self-contained build instruction** for one agent. Strategy and evidence live in [../MASTER_PLAN.md](../MASTER_PLAN.md) and [../RESEARCH_HIGGSFIELD.md](../RESEARCH_HIGGSFIELD.md) — you don't need them to build, but read the plan's "Rules for builder agents" section before starting.

## Dependency graph

```
Phase 0 (serial-ish):   WO-01 ──► WO-02 ─────────────┐
                        WO-01 ──► WO-03 ─────────────┤
Phase 1 (parallel):     WO-03 ──► WO-04, WO-05, WO-06, WO-15 (deploy early!)
Phase 2 (parallel):     WO-02+06 ► WO-07 ──► WO-08 ──► WO-09 · WO-16 (site, needs 15)
Phase 3 (parallel):     WO-10 (07,09) · WO-11 (08,09,10) · WO-12 (02,08)
                        WO-13 (07,08,12) · WO-14 (05,06) · WO-18 (05,07,15)
Release gate:           WO-17 (04,15,16) — QUALITY_BAR becomes CI; first public release ships through it
```

Critical path: **WO-01 → WO-02/03 → WO-04 → WO-09 → WO-11 → WO-17**.

## Per-WO protocol

0. **Read [../HANDOFF.md](../HANDOFF.md) first** — verified baseline, repo contracts, integration table, gotchas. Then check [../BUILD_LEDGER.md](../BUILD_LEDGER.md) for anything that changed since.
1. Branch `wo/NN-slug` off `main`. Append a `STARTED` entry to the ledger and flip your row on its status board.
2. Read the WO fully, then every repo file it names, before writing code.
3. Build to spec; follow existing repo patterns (Zod schema → provider → smoke script → wire into `npm run check`). Contracts owned by other WOs (HANDOFF §9): code against their spec, don't fork them.
4. Run the WO's acceptance commands; paste real output in the PR description.
5. Small single-purpose commits; open a **draft PR**; do not merge to main. Never end a session with an un-pushed branch — push WIP + a ledger note saying exactly where you stopped.
6. If the repo has drifted from a WO's assumptions, update the WO file in the same PR and note it in the ledger.
7. On finish: ledger entry (`LANDED`/`IN-REVIEW`) with discoveries, update `PROGRESS.md` next action.

## Index

| WO | Title | Phase |
|----|-------|-------|
| [WO-01](./WO-01-real-file-io.md) | Real file I/O — `.glb` on disk | 0 |
| [WO-02](./WO-02-engine-bridge.md) | Python engine ↔ TS bridge (True Unlimited local tier) | 0 |
| [WO-03](./WO-03-job-queue.md) | Durable queue + SSE progress + refund-on-failure | 0 |
| [WO-04](./WO-04-web-workspace.md) | Web workspace + 3D viewer | 1 |
| [WO-05](./WO-05-auth-projects.md) | Auth + projects (local mode stays account-free) | 1 |
| [WO-06](./WO-06-cost-meter.md) | Cost estimate + live meter + budget cap | 1 |
| [WO-07](./WO-07-model-gateway.md) | Multi-model gateway (fal/Replicate + local) | 2 |
| [WO-08](./WO-08-camera-presets.md) | Camera-move preset library (real 3D paths) | 2 |
| [WO-09](./WO-09-character-anchor.md) | Character anchor — zero-drift consistency | 2 |
| [WO-10](./WO-10-audio-lipsync.md) | Native audio + bone-driven lipsync | 3 |
| [WO-11](./WO-11-timeline-editor.md) | Scene-graph timeline, multi-shot sequences | 3 |
| [WO-12](./WO-12-4k-output.md) | 4K output, upscaling included | 3 |
| [WO-13](./WO-13-pro-export-api.md) | Public API all tiers, batch, ProRes/alpha, 3D export | 3 |
| [WO-14](./WO-14-honest-billing.md) | Honest billing + TRUST.md policy gates | 3 |
| [WO-15](./WO-15-deploy-ops.md) | Deployment, CI, observability, status page | 1 |
| [WO-16](./WO-16-marketing-site.md) | Design system + marketing site (implements SITE_SPEC) | 2 |
| [WO-17](./WO-17-quality-gate.md) | Quality gate — QUALITY_BAR as CI | gate |
| [WO-18](./WO-18-safety-legal.md) | Content safety + legal pages | 3 |

Site requirements: [../SITE_SPEC.md](../SITE_SPEC.md) · Release bar: [../QUALITY_BAR.md](../QUALITY_BAR.md) · Risk register & mandated fallbacks: [../PLAN_REVIEW.md](../PLAN_REVIEW.md)
