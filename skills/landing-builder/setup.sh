#!/usr/bin/env bash
# setup.sh — one-time prewarm for the landing-builder template. Idempotent +
# latched: safe to run before every job; the heavy npm install happens once.
# The agent pod overlay-persists node_modules on the DATA PVC.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE/boilerplate"

LATCH="$HERE/.setup-done"
if [ -f "$LATCH" ] && [ -d node_modules/vite ]; then
  echo "[setup] already done"
  exit 0
fi

echo "[setup] npm install (Vite + React + Tailwind + shadcn)…"
npm install --no-audit --no-fund --loglevel=error

# Prove the scaffold builds so the first real job isn't the first build.
echo "[setup] build check…"
npm run build >/dev/null 2>&1 || echo "[setup] warn: build check failed (non-fatal)"

touch "$LATCH"
echo "[setup] done"
