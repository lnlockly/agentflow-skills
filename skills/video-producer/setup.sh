#!/usr/bin/env bash
# setup.sh — ONE-TIME environment prep for the video-producer skill, run inside
# the agent pod. Idempotent + latched: safe to call before every job; the heavy
# work happens only once (npm install + esbuild rebuild). Whisper.cpp + the
# medium model download themselves on the first `sub.mjs` run (NOT prefetched
# here — that download is multi-GB and would time out a setup step).
#
# The agent pod overlay-persists /usr /opt /root on the DATA PVC, so node_modules,
# the whisper model, and pip packages SURVIVE pod restarts — paid once per agent.
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

# Best-effort Python deps for optional smart face-crop of imported footage.
# Never fatal: if python/pip is missing or the wheels don't resolve, the reel
# still renders (face-crop just falls back to a centre crop). Guarded so a
# failure here can NEVER break the latch or the render pipeline.
echo "[setup] pip: mediapipe + opencv (best-effort, non-fatal)…"
if command -v python3 >/dev/null 2>&1; then
  python3 -m pip install --user --quiet --disable-pip-version-check \
    mediapipe opencv-python-headless >/dev/null 2>&1 \
    && echo "[setup] pip: face-crop deps ready" \
    || echo "[setup] pip: face-crop deps unavailable — using centre-crop fallback"
else
  echo "[setup] pip: no python3 — skipping face-crop deps (centre-crop fallback)"
fi

mkdir -p public/assets out
touch "$LATCH"
echo "[setup] done"
