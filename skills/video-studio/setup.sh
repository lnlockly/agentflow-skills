#!/usr/bin/env bash
# setup.sh — ONE-TIME env prep for the video-studio MCP server. Idempotent +
# latched: safe to call before every job; the heavy work runs only once. The
# agent pod overlay-persists /usr /opt /root /root/.hermes on the DATA PVC, so
# node_modules, pip wheels and the whisper model SURVIVE pod restarts.
#
#   bash setup.sh
#
# What it installs:
#   1. The MCP server's own Node dep (@modelcontextprotocol/sdk) in THIS dir.
#   2. The proven Remotion render project (the sibling video-producer skill):
#      its npm deps + esbuild rebuild (delegates to its own setup.sh).
#   3. Python deps for face_crop.py: mediapipe + opencv-python-headless + numpy
#      (+ optional scenedetect). Headless/CPU wheels only — clean in gVisor,
#      no torch, no GUI libs.
set -euo pipefail
cd "$(dirname "$0")"
HERE="$(pwd)"

LATCH=".setup-done"
if [ -f "$LATCH" ] && [ -d node_modules/@modelcontextprotocol ]; then
  echo "[setup] already done"
  exit 0
fi

# --- 1. MCP SDK (this dir) --------------------------------------------------
echo "[setup] npm install @modelcontextprotocol/sdk…"
npm install --no-audit --no-fund --loglevel=error

# --- 2. Proven Remotion render project (video-producer) ---------------------
# Resolve the studio dir the same way mcp-server.mjs does.
STUDIO="${VIDEO_STUDIO_DIR:-$HERE/../video-producer}"
if [ -d "$STUDIO" ] && [ -f "$STUDIO/package.json" ]; then
  echo "[setup] preparing Remotion studio at $STUDIO"
  if [ -f "$STUDIO/setup.sh" ]; then
    bash "$STUDIO/setup.sh" || echo "[setup] WARN: studio setup.sh returned non-zero"
  else
    ( cd "$STUDIO" && npm install --no-audit --no-fund --loglevel=error && \
      npm rebuild esbuild --foreground-scripts >/dev/null 2>&1 || true )
  fi
else
  echo "[setup] WARN: video-producer studio not found at $STUDIO."
  echo "        Set VIDEO_STUDIO_DIR to the Remotion project root (has package.json + src/index.ts)."
fi

# --- 3. Python deps for face_crop.py ----------------------------------------
echo "[setup] pip install mediapipe + opencv-python-headless + numpy…"
PYBIN="$(command -v python3 || command -v python || true)"
if [ -n "$PYBIN" ]; then
  "$PYBIN" -m pip install --quiet --disable-pip-version-check \
    mediapipe opencv-python-headless numpy 2>/dev/null \
    || echo "[setup] WARN: face-tracking deps failed; face_crop falls back to ffmpeg blurred-fit (still works)."
  # Optional: snap cuts to visual scene boundaries. Non-fatal if it fails.
  "$PYBIN" -m pip install --quiet --disable-pip-version-check "scenedetect[opencv]" 2>/dev/null || true
else
  echo "[setup] WARN: no python3; face_crop track mode disabled (general fit still works)."
fi

touch "$LATCH"
echo "[setup] done"
