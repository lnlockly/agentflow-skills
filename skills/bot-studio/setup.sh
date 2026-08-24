#!/usr/bin/env bash
# setup.sh — ONE-TIME prep for the bot-studio MCP server. The generic MCP cycle
# in the agent entrypoint runs this BEFORE `hermes mcp add`, so the server's dep
# (@modelcontextprotocol/sdk) is present when it registers. Idempotent + latched;
# node_modules survives pod restarts via the DATA-PVC overlay.
set -euo pipefail
cd "$(dirname "$0")"

if [ -f ".setup-done" ] && [ -d node_modules/@modelcontextprotocol ]; then
  echo "[bot-studio] already done"; exit 0
fi
echo "[bot-studio] npm install @modelcontextprotocol/sdk…"
npm install --no-audit --no-fund --loglevel=error
mkdir -p /app/data/bots
touch ".setup-done"
echo "[bot-studio] done — MCP ready (tools: list_bots, bot_stats, bot_referrals, bot_broadcast)."
