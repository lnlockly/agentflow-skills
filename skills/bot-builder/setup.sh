#!/usr/bin/env bash
# setup.sh — ONE-TIME env prep for the bot-builder skill, run inside the agent
# pod. Idempotent + latched: safe to call before every job. The agent pod
# overlay-persists /usr /opt /root on the DATA PVC, so node_modules + the Prisma
# client + the MCP registration SURVIVE pod restarts — paid once per agent.
#
# Two things get warmed:
#   1) the SHARED boilerplate/ (grammY + Prisma) — each bot the agent builds is a
#      COPY of it, so per-bot `npm install && npm run db:push` resolves instantly.
#   2) the bot-admin MCP (view/manage the built bots) — deps + registration.
set -euo pipefail
SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── 1) boilerplate prewarm ──────────────────────────────────────────────────
cd "$SKILL_DIR/boilerplate"
if [ -f ".setup-done" ] && [ -d node_modules/grammy ] && [ -d node_modules/.prisma/client ]; then
  echo "[setup] boilerplate already warm"
else
  echo "[setup] npm install (grammy + @grammyjs/* + @prisma/client + zod + tooling)…"
  npm install --no-audit --no-fund --loglevel=error
  echo "[setup] prisma generate…"
  npx prisma generate >/dev/null
  touch ".setup-done"
  echo "[setup] boilerplate warm."
fi

# ── 2) bot-admin MCP (first-class tools to view users/referrals/conversions +
#       run broadcasts across the bots the agent built) ───────────────────────
cd "$SKILL_DIR/mcp"
[ -d node_modules/@modelcontextprotocol ] || {
  echo "[setup] npm install (bot-admin MCP)…"
  npm install --no-audit --no-fund --loglevel=error
}
mkdir -p /app/data/bots
if command -v hermes >/dev/null 2>&1 && ! hermes mcp list 2>/dev/null | grep -qi "bot-admin"; then
  # `hermes mcp add` is interactive ("Enable all N tools? [Y/n]") — `yes` auto-accepts.
  if yes | hermes mcp add bot-admin --command node --args "$SKILL_DIR/mcp/server.mjs" --env "BOTS_ROOT=/app/data/bots" >/dev/null 2>&1; then
    echo "[setup] bot-admin MCP registered (tools: list_bots, bot_stats, bot_referrals, bot_broadcast)"
  else
    echo "[setup] bot-admin MCP auto-register skipped — add later: hermes mcp add bot-admin --command node --args $SKILL_DIR/mcp/server.mjs --env BOTS_ROOT=/app/data/bots"
  fi
fi

echo "[setup] done — scaffold a bot into /app/data/bots/<name> from boilerplate."
