#!/usr/bin/env bash
# setup.sh — ONE-TIME env prep for the agent-media MCP server. Idempotent +
# latched: safe to call before every boot; the npm install runs only once. This
# skill is THIN (no ffmpeg/whisper/remotion/python) — its only dep is the MCP
# SDK, so setup is fast. node_modules persists on the DATA PVC overlay.
#
#   bash setup.sh
set -euo pipefail
cd "$(dirname "$0")"

LATCH=".setup-done"
if [ -f "$LATCH" ] && [ -d node_modules/@modelcontextprotocol ]; then
  echo "[setup] already done"
  exit 0
fi

echo "[setup] npm install @modelcontextprotocol/sdk…"
npm install --no-audit --no-fund --loglevel=error

touch "$LATCH"
echo "[setup] done"
