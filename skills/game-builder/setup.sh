#!/usr/bin/env bash
# setup.sh — ONE-TIME prep for the game-builder skill, run inside the agent pod.
# Idempotent + latched. Installs the LIGHT asset-tool deps (search + kit slicing).
# Node/Vite/Babylon are installed per-game by the agent when it scaffolds a project.
set -euo pipefail
cd "$(dirname "$0")"

if [ -f ".setup-done" ] && python3 -c "import PIL, requests" 2>/dev/null; then
  echo "[game-builder] already set up"; exit 0
fi
echo "[game-builder] pip install pillow + requests (free asset search + kit slicing)…"
# LIGHT only. asset-gen/tools/requirements.txt lists the FULL generation stack
# (rembg/onnxruntime-gpu/xai-sdk/google-genai) — heavy + needs API keys/GPU; install
# on demand only when the user wires paid generation. Free search needs nothing.
python3 -m pip install --quiet --disable-pip-version-check requests pillow || true
mkdir -p /app/data/games
touch ".setup-done"
echo "[game-builder] ready. Free assets: ambientCG (no key). For 3D set POLY_PIZZA_KEY."
echo "[game-builder] Scaffold a game into /app/data/games/<name> (see engines/babylon.md)."
