#!/usr/bin/env bash
# setup.sh — ONE-TIME env prep for the bot-builder skill, run inside the agent
# pod. Idempotent + latched. The agent pod overlay-persists /usr /opt /root on
# the DATA PVC, so node_modules + the Prisma client SURVIVE pod restarts.
#
# Prewarms the SHARED boilerplate/ (grammY + Prisma): each bot the agent builds
# is a COPY of it, so per-bot `npm install && npm run db:push` resolves instantly.
#
# NOTE: the bot-admin MCP is NOT registered here — it ships as the separate
# `bot-studio` skill and is registered by the generic MCP cycle from this
# template's `install.mcp` (see template.yaml). No manual `hermes mcp add`.
set -euo pipefail
cd "$(dirname "$0")/boilerplate"

if [ -f ".setup-done" ] && [ -d node_modules/grammy ] && [ -d node_modules/.prisma/client ]; then
  echo "[setup] boilerplate already warm"; exit 0
fi
echo "[setup] npm install (grammy + @grammyjs/* + @prisma/client + zod + tooling)…"
npm install --no-audit --no-fund --loglevel=error
echo "[setup] prisma generate…"
npx prisma generate >/dev/null
mkdir -p /app/data/bots
touch ".setup-done"
echo "[setup] boilerplate warm — scaffold a bot into /app/data/bots/<name>."
