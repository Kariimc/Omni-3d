# CLAUDE.md — Omni3D operating manual

Omni3D: video-native 3D production studio (video → voxel draft → retopo → auto-rig → mocap
retarget → engine-in-the-loop validation → live-sync to UE5/Unity). TypeScript + Fastify 5 +
Zod, run via `tsx`, **no build step**, ESM, 8 runtime deps. The long-term mission is the
Higgsfield-competitor plan in `docs/plan/`.

## Read this first, then in this order

1. This file (rules that apply to every task).
2. `PROGRESS.md` — current focus and the exact next action. **Always start here for "what's next".**
3. If building a work order: `docs/plan/HANDOFF.md` → your WO file in `docs/plan/work-orders/`
   → `wargames/README.md` (carried intel — verified facts; do NOT re-derive them)
   → `docs/plan/BUILD_LEDGER.md` (what changed since the handoff was written).
4. If touching UI/site: `docs/plan/SITE_SPEC.md` + `docs/plan/QUALITY_BAR.md`.
5. If a known risk fires: the mandated fallback is in `docs/plan/PLAN_REVIEW.md` §2 — follow it,
   don't improvise.

When this file and a plan doc disagree on a repo fact, trust the newest ledger entry, then
verify against the code itself.

## The one command that matters

```bash
npm run check    # typecheck + payload validation + every smoke suite
```

- Run it **before** changing anything (baseline) and **after** every meaningful change.
- A red baseline means STOP and report — never "fix" unrelated failures to get to your task.
- `npm run check` green is the merge gate. Every feature extends it with its own smoke.
- `npm run pipeline:real` must print `status: passed` (6 real providers).

## How I work (the workflow you must follow)

- **One unit of work = one branch = one draft PR.** Work orders use `wo/NN-slug`; wargames use
  the branch named in the wargame file. Never merge to main — that is the owner's gate, always.
- **Plan → wargame → execute.** Non-trivial work gets a wargame (`wargames/NN-*.md`): a
  move-by-move battle plan with expected observations, failure forks, RECON-NEEDED checks, and
  abort conditions, written so a cheaper executor runs it without questions. Use `/wargame`.
- **State preservation is law.** `docs/plan/BUILD_LEDGER.md` is append-only running memory:
  append at start, on every discovery, and at finish (format is defined in the file). Update
  `PROGRESS.md` when focus changes. Never end a session with an un-pushed branch — push WIP
  with a `WIP:` commit and a ledger note saying exactly where you stopped. Use `/handoff`.
- **PRs paste evidence.** Acceptance-command outputs go verbatim in the PR description.
- Commits: small, single-purpose, plain imperative messages ("Add real EITL provider: …").
  No model names, no emoji, no "🤖" beyond the mandated trailer.

## Code conventions (existing, plus additions — mirror what's there)

**Existing:**
- Strict TypeScript (`strict` + `noUncheckedIndexedAccess`); typecheck is `tsc --noEmit` only.
- Zod everywhere: `.strict()` objects, `safeParse` + 400-with-issues at every API boundary.
  All wire contracts live in `src/schemas/` with a versioned `$omni3d` tag (`thing/v1`).
- `structuredClone` before mutating any stored object (see `advanceJob`) — never mutate in place.
- Pure factories + DI: `buildApp(store, bus, assets?)` never calls `listen()`; new dependencies
  are optional-with-default parameters so existing callers keep compiling
  (`grep -rn "buildApp(" src/` before touching the signature). Tests use `app.inject()` or
  `listen({ port: 0 })`.
- Tests are bespoke `src/smoke-<thing>.ts` scripts, no framework: local `check(ok, label)`
  printing `✓/✗` lines, a final `<THING> SMOKE PASS`, non-zero exit on failure, self-contained
  (own temp dirs, own env vars set **before** dynamic `await import(...)` of the code under
  test). Wired into the `check` chain in `package.json`. Use `/smoke` to scaffold one.
- Comments: sparse, contract-level `/** ... */` on interfaces/functions. No narration, no
  change-log comments.
- `node:path` joins everywhere; never hardcode `/`-rooted paths (owner dev box is Windows 11,
  Git Bash/PowerShell).

**Additions (follow these too):**
- New env vars: read in `src/config.ts` (plain object, no validation lib), document in
  `.env.example`, and everything must work with **zero env vars set** (in-memory first;
  pg/Supabase is the upgrade path, never the requirement).
- New persisted entities: extend `JobStore` (or a sibling interface) in **both** `memory.ts`
  and `supabase.ts`, and ship the SQL in `supabase/migrations/` in the same PR.
- New live events: extend the `LiveEvent` discriminated union in `src/live/events.ts` (types
  are DOT-separated: `job.done`, not `job:done`) — never send ad-hoc JSON on the bus.
- Schema evolution: never change an existing `/v1` schema's meaning. Add fields `.optional()`
  or mint `/v2`. After schema changes run `npm run export:schema` — `schemas/json/*` and
  `docs/payloads/*` are GENERATED; never hand-edit them.
- New routes go through `buildApp`, validate input with `safeParse`, and get smoke coverage
  including at least one negative case (bad input → 4xx).

## Mistakes a weaker model WILL make here — named, with the preventing rule

1. **"Fixing" the scaffold boundary.** The real providers run real algorithms on PROCEDURAL
   inputs (`buildStageContext()`); `asset://` URIs in old payloads may resolve to nothing.
   This is documented design, not a bug. Rule: anything listed under "scaffold boundary" in
   `wargames/README.md` is off-limits unless your WO explicitly closes that seam.
2. **Weakening a smoke to get green.** Rule: never edit an assertion, threshold, or expected
   value in an existing `smoke-*.ts` to make your change pass. If a smoke fails, either your
   change is wrong or you found a real drift — ledger it and escalate.
3. **Reimplementing stage sequencing.** Rule: the ONLY way a job moves forward is
   `advanceJob(job, opts, overrides)` (`src/loops/runner.ts`). New stage logic injects via the
   `overrides` DI seam keyed `"A1"`…`"C"`. Do not add a second runner; do not touch
   `STAGE_PLAN` order/semantics without escalation.
4. **Bypassing `appendEvent`.** Rule: every persisted event goes through
   `JobStore.appendEvent`, which assigns the monotonic `seq` that makes WebSocket replay
   gap-free. Publishing to the bus without appending (or vice versa) silently breaks replay —
   the persist+publish pairing lives in the `/advance` handler in `src/app.ts`; reuse it.
5. **Touching the `/live` replay→live handoff casually.** Rule: `src/app.ts` subscribes FIRST,
   then replays from the log, deduping by `seq > lastSent`. The ordering is deliberate and
   smoke-tested (`smoke:live`, `smoke:bus`, `smoke:live-replay`, `smoke:race`). Read all four
   smokes before changing a line of it.
6. **Breaking the `public/` dashboard silently.** Rule: `/` serves a real dashboard that reads
   the same job/event APIs. After any API response-shape change, click through `/` (or run the
   relevant smoke) — it fails silently otherwise. It stays working until a WO deliberately
   replaces it.
7. **Hand-editing generated files.** Rule: `schemas/json/*.schema.json` and
   `docs/payloads/*.json` come from `npm run export:schema` / the Zod source of truth.
   Regenerate, never edit.
8. **Adding dependencies.** Rule: the server runs on 8 runtime deps. Your WO lists what you may
   add; anything else needs an explicit plain-language justification in the PR — prefer writing
   the 50 lines yourself.
9. **Adding a build step.** Rule: `npm start` is `tsx src/server.ts`. Never introduce `dist/`,
   bundlers, or compile-to-run for the server.
10. **Trusting v0 examples for pinned libs.** Jimp is v1 (`new Jimp({width,height,color})`,
    `img.getBuffer("image/png")`); `meshoptimizer` is the WASM build with async init (see
    `src/loops/providers/retopology.ts`); `@fastify/multipart` is v10. Rule: copy usage from
    this repo's providers, not from the internet.
11. **Windows blindness.** Rule: `node:path` everywhere; CRLF warnings from git are harmless —
    do NOT "fix" line endings in unrelated files; manual `curl -F file=@…` on Windows needs a
    repo-relative path (MSYS `/tmp` fails with curl error 26, which looks like a server crash).
12. **Inventing a contract another WO owns.** Rule: the cross-WO contract table is
    `docs/plan/HANDOFF.md` §9. If you need a contract you don't own, code against the WO spec
    and mark the ledger `BLOCKED-ON: WO-NN`. Changing a contract you don't own = escalation.
13. **Letting knowledge evaporate.** Rule: any discovery the next agent needs (version quirk,
    drift from a plan doc, decision made) goes in `BUILD_LEDGER.md` the moment you learn it —
    not only in the PR text, and never only in your head.
14. **Killing the manual advance flow.** Rule: existing smokes drive `POST /jobs/:id/advance`;
    any queue/worker keeps it behind `features.manualAdvance`, never deletes it. `?defect=`
    injection is how repair-path smokes work — keep it.

## Quality bar per deliverable (checkable, not adjectives)

**Any code change (minimum bar):**
- [ ] `npm run check` green before AND after; output tail pasted in the PR.
- [ ] No existing smoke assertion weakened; no generated file hand-edited.
- [ ] Works with zero env vars set (in-memory path).
- [ ] `grep -rn "buildApp(" src/` still compiles if you touched the factory signature.

**A new feature:**
- [ ] All of the above, plus a new `src/smoke-<thing>.ts` wired into `check` (and `package.json`
      scripts) with ≥1 happy path and ≥1 negative case, printing `✓` lines + `<THING> SMOKE PASS`.
- [ ] New wire surfaces: strict Zod schema, versioned tag if payload-level, exporter/validator
      coverage extended, sample payload in `docs/payloads/` if job-level.
- [ ] New persisted entity: memory + Supabase implementations + migration SQL, same PR.
- [ ] `docs/plan/BUILD_LEDGER.md` entry appended (STARTED → … → final status).
- [ ] README/PROGRESS updated if the repo map, API table, or "next action" changed.

**A work order (WO):**
- [ ] Everything above, on branch `wo/NN-slug`, as a DRAFT PR, acceptance-command outputs
      verbatim in the description.
- [ ] WO file updated in the same PR if the repo drifted from its assumptions.
- [ ] Status board row in `BUILD_LEDGER.md` updated.
- [ ] UI/site WOs: budgets from `QUALITY_BAR.md` respected (Lighthouse ≥95/90, WCAG 2.2 AA,
      honesty gates — these are CI-enforceable pass/fail numbers, treat them as tests).

**A wargame document:**
- [ ] Numbered sequentially, one mission, runnable by a cheaper executor with zero questions.
- [ ] Every move has an expected observation + most-likely failure → cause → counter-move.
- [ ] Every fork has a concrete trigger; unsettled assumptions are marked RECON NEEDED with the
      exact settling check; ends with abort conditions + verification runs with pass criteria.
- [ ] Row added to the table in `wargames/README.md`; durable findings added to carried intel.

**A plan/handoff doc:**
- [ ] Claims are dated and marked verified vs on-paper (`[on-paper]`).
- [ ] Entry points cross-link (PROGRESS → HANDOFF → WO → ledger); no orphan doc.

## When uncertain — exact escalation rules

**STOP and report (draft PR comment + ledger `BLOCKED-ON:` entry; do not push through) when:**
1. Baseline `npm run check` is red before your change.
2. Your fix requires changing a contract another WO owns (HANDOFF §9), changing `STAGE_PLAN`
   semantics/order, or changing an existing `/v1` schema's meaning.
3. You need a secret/credential not in `.env.example` (FAL, Stripe, Supabase project) —
   mock it, request it in the PR, ledger `BLOCKED-ON: credentials`.
4. Anything security-shaped: committed secrets, path traversal beyond the existing guard,
   auth bypass, or a dependency with install scripts you can't justify.
5. A dependency outside your WO's allowance seems genuinely necessary.
6. An existing smoke fails and the fix would mean weakening its assertion.
7. Merging to main, force-pushing a shared branch, or deleting user data — never, without the
   owner saying so in this conversation.

**Decide yourself (do NOT ask) when:**
- Choosing names, file layout, or test structure consistent with existing patterns.
- Additive changes to a contract your own WO owns (note them in the ledger).
- Which of two implementations to pick when both meet the WO spec — pick, record why in the
  ledger, move on.
- A plan doc contradicts the code: the code is truth; update the doc in your PR and ledger it.

**In between (ambiguous scope, two defensible readings of a requirement):** implement the
narrower reading, state the interpretation explicitly in the PR description and ledger, and
flag the alternative — don't block, don't silently choose the expansive one.

## Session end (never skip)

Push the branch (even `WIP:`), append the ledger entry with an exact "Next:" line, update
`PROGRESS.md` if focus moved, ensure a draft PR exists. `/handoff` does all of this.
