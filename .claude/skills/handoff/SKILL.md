---
name: handoff
description: End-of-session state preservation for Omni3D — append the BUILD_LEDGER entry, update PROGRESS.md and the status board, push the branch (WIP if needed), and ensure a draft PR exists so zero knowledge evaporates between sessions/agents. Use at the end of every working session, when pausing a WO mid-flight, or when the user says "wrap up", "hand off", or "stopping here".
---

# /handoff — leave the repo so the next agent loses nothing

The state-preservation protocol (HANDOFF.md §10) is law: ledger is memory, PROGRESS is the
pointer, branches are never left un-pushed. This skill executes it completely and verifiably.

## Procedure

### 1. Establish what actually happened (don't trust memory)

```bash
git status && git log --oneline origin/<branch>..HEAD 2>/dev/null || git log --oneline -10
npm run check   # if code changed this session — record green tail or the exact failure
```

Identify: which WO/wargame/task, what is *verified done* (command + result, not intentions),
what was *discovered* (quirks, drift from plan docs, decisions made), and the *exact* next
action (a command or a move number, not "continue").

### 2. Commit the work

- Finished increment → normal commit (small, single-purpose, plain imperative message).
- Unfinished → commit anyway as `WIP: <where you stopped, one line>`. Broken WIP is fine;
  un-pushed work is not. Never `git stash` and walk away; never reset away real work.
- Do NOT commit `data/`, `.env`, or hand-edits to generated files (`schemas/json/`,
  `docs/payloads/` — regenerate instead).

### 3. Append the ledger entry — `docs/plan/BUILD_LEDGER.md`

Append-only, newest at the bottom, exact house format:

```
### [WO-NN] <short title> — <STATUS> — <YYYY-MM-DD>
- Agent/session: <who>
- Branch/PR: <branch> · <PR url or "not opened yet">
- Done: <verified facts only — cite command + result, e.g. "npm run check green, 13 suites">
- Discovered: <what the next agent must know; omit nothing you'd need after amnesia>
- Next: <the exact next action — command, wargame move number, or file:line>
- BLOCKED-ON: <WO-NN / credentials / owner decision — omit if not blocked>
```

STATUS ∈ `STARTED | WIP | BLOCKED | IN-REVIEW | LANDED | CORRECTION`. Also update the WO
status-board table in the same file (the one permitted in-place edit).

### 4. Update the pointers

- `PROGRESS.md`: "Current focus" + "Next action" reflect reality after this session; update
  "State of the code" if the verified baseline changed (new smoke count, new landed branch).
- If the session drifted from a WO/wargame's assumptions, update that file too and say so in
  the ledger (`Discovered:`).

### 5. Push and ensure a PR exists

```bash
git push -u origin <branch>    # retry ×4 with backoff on network failure only
```

If no open PR exists for the branch, create one — **draft**, titled after the WO/mission,
body containing: what's done, acceptance-command outputs pasted verbatim, what remains, and
the `Next:` line from the ledger. Never merge; the owner merges.

### 6. Verify the handoff (the whole point)

Re-read your own ledger entry and PROGRESS.md and ask: *could a fresh agent with zero context
resume from these two files plus `git log` alone?* If any answer requires this session's
memory, it goes in the ledger now. Then report to the user: branch, PR link, status, and the
one-line next action.
