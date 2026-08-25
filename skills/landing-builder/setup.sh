#!/usr/bin/env bash
# setup.sh — prewarm + refresh for the landing-builder template. Idempotent and
# safe to run before every job AND on every skill resync: it materialises the
# working scaffold at $LANDING_STUDIO_DIR from this skill's boilerplate, so a
# hub update to the deck engine / components actually reaches the studio the agent
# builds from. The heavy npm install happens once (node_modules is preserved on
# the DATA PVC and across refreshes).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
STUDIO="${LANDING_STUDIO_DIR:-/app/data/landing-studio}"

# 1) Sync the scaffold CODE into the studio, overlaying the latest boilerplate
#    (src/, deck engine, config) WITHOUT clobbering the studio's installed
#    node_modules/dist. The agent's generated sites live in /app/data/landings
#    (a SIBLING of the studio), so they are never touched here.
mkdir -p "$STUDIO"
( cd "$HERE/boilerplate" && tar cf - --exclude=node_modules --exclude=dist . ) | ( cd "$STUDIO" && tar xf - )

cd "$STUDIO"

# 2) Install deps once (and reconcile new ones like framer-motion on a refresh).
if [ ! -d node_modules/vite ] || [ package.json -nt node_modules/.package-lock.json ] 2>/dev/null; then
  echo "[setup] npm install (Vite + React + Tailwind + shadcn + framer-motion)…"
  npm install --no-audit --no-fund --loglevel=error
else
  echo "[setup] deps present — skipping npm install"
fi

# 3) Prove the scaffold builds so the first real job isn't the first build.
echo "[setup] build check…"
npm run build >/dev/null 2>&1 || echo "[setup] warn: build check failed (non-fatal)"

echo "[setup] done (studio=$STUDIO)"
