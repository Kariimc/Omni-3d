#!/bin/bash
set -euo pipefail

# Omni3D SessionStart hook — prepares Claude Code on the web sessions so that
# `npm run check` (tsc + payload validation + smoke/live/bus/sampler/retopo) runs.
# Synchronous: the session waits until deps are installed (no race conditions).

# Only run in the remote (web) environment; local sessions manage their own deps.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# Idempotent: safe to re-run. `npm install` (not `npm ci`) so the cached container
# layer is reused across sessions.
npm install --no-audit --no-fund
