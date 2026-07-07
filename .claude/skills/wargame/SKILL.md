---
name: wargame
description: Author a new Omni3D wargame — a move-by-move battle plan a cheaper executor agent runs without questions — in the repo's established format, wired into wargames/README.md. Use before executing any non-trivial mission (building a WO, a bug hunt, a risky refactor). Args: the mission, e.g. "/wargame WO-03 job queue" or "/wargame hunt races in the supabase store".
---

# /wargame — write a battle plan for a cheaper executor

Wargames (`wargames/NN-*.md`) are how this repo turns expensive planning into cheap, safe
execution: a stronger model verifies reality and writes the plan; a weaker model executes it
move-by-move. The plan absorbs ALL the judgment so the executor needs none. Precedents:
`wargames/07-bugs.md` (bug hunt), `08-wo01-file-io.md` (build), `09-wo03-job-queue.md` (build,
written not run).

## Procedure

### 1. Recon before writing (never plan from docs alone)

- Read `wargames/README.md` carried intel — do NOT re-derive settled facts; cite them.
- Read the mission's WO file (if any), `docs/plan/HANDOFF.md` §§4–9, and the latest
  `BUILD_LEDGER.md` entries.
- **Verify against the code**: open every file the plan will name; run `npm run check` and
  record the green tail as the baseline the executor must reproduce. Every claim in the plan
  is either *verified* (you observed it this session) or tagged **[on-paper]** — and every
  [on-paper] claim that a move depends on becomes a **RECON NEEDED** item with the exact
  settling check (a command or a file:line to read) placed BEFORE the move that needs it.

### 2. Write `wargames/NN-<slug>.md` (next sequential number)

Required structure, in order:

1. **Header block**: mission (one sentence), branch the executor uses (`wo/NN-slug` for WOs,
   `wargame/NN-slug` otherwise), files it may touch, files it must NOT touch, dependencies
   it may add (usually none), and the ledger-entry instruction (append `STARTED` on branch).
2. **Move 0 — baseline**: `npm install && npm run check`, with the expected green tail pasted.
   "If red: STOP, ledger it, abort" — this is always Move 0.
3. **Numbered moves**, each containing:
   - The exact action (commands, file edits described precisely — file, location, intent;
     include code sketches only where the shape is non-obvious).
   - **Expected observation** — what the executor sees when the move worked (command output,
     smoke line, HTTP status). This is the checkpoint.
   - **Most-likely failure → cause → counter-move** — at least one per risky move. If the
     counter-move branches, write it as a fork.
   - **Forks** get concrete triggers: "if you observe X, take route B (moves 5b–5d)". Never
     "use your judgment".
4. **Abort conditions** — the exact observations that mean stop, ledger, report (baseline red,
   an owned-elsewhere contract must change, a secret is needed, a smoke would need weakening).
5. **Final verification** — the list of commands with per-run pass criteria (always ends with
   full `npm run check` green + the mission's own smoke), plus PR instructions (draft PR,
   outputs pasted verbatim) and the ledger verdict line
   (`FIXED | NOT-A-BUG | RECON-NEEDED | ABORTED | LANDED`).

Style: imperative, terse, zero ambiguity. The test for every sentence: could a model that has
read nothing else execute it and know whether it worked? If a move needs context, inline the
context (or the file:line to read) — don't assume prior knowledge.

### 3. Wire it in (same commit)

- Add a row to the table in `wargames/README.md` (status: `written, not yet run`).
- If recon surfaced a durable repo fact, add it to the carried-intel section (tag
  [on-paper] items honestly).
- Update `PROGRESS.md` "Next action" if this wargame is now it.

### 4. Self-check before committing

- [ ] Every move has an expected observation.
- [ ] Every [on-paper] dependency has a RECON NEEDED settling check before its move.
- [ ] Every fork has an observable trigger.
- [ ] Abort conditions + final verification with pass criteria are present.
- [ ] Nothing in the plan asks the executor to weaken a smoke, touch STAGE_PLAN semantics,
      change a /v1 schema, or modify a contract another WO owns.
- [ ] Index row + carried intel updated.
