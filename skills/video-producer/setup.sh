#!/usr/bin/env bash
# setup.sh — ONE-TIME environment prep for the video-producer skill, run inside
# the agent pod. Idempotent + latched: safe to call before every job; the heavy
# work happens only once (npm install + esbuild rebuild). Whisper.cpp + the
# medium model download themselves on the first `sub.mjs` run.
#
# The agent pod overlay-persists /usr /opt /root on the DATA PVC, so node_modules
# and the whisper model SURVIVE pod restarts — this cost is paid once per agent.
set -euo pipefail
cd "$(dirname "$0")"

LATCH=".setup-done"
if [ -f "$LATCH" ] && [ -d node_modules/remotion ]; then
  echo "[setup] already done"
  exit 0
fi

echo "[setup] npm install (Remotion + captions + whisper + google-fonts)…"
npm install --no-audit --no-fund --loglevel=error
# npm >=11 blocks esbuild's postinstall (allowScripts) — force it so bundling works.
npm rebuild esbuild --foreground-scripts >/dev/null 2>&1 || true

mkdir -p public/assets out
touch "$LATCH"
echo "[setup] done"
