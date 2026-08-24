#!/usr/bin/env bash
# setup.sh — ONE-TIME prep for the deck-studio MCP. Idempotent + latched.
# Installs the MCP SDK + Marp CLI (which drives HTML/PDF/PPTX export). Marp needs
# a Chromium for PDF/PPTX — the agent image already ships Playwright's Chromium
# (BROWSER_EXECUTABLE), which the MCP passes to Marp via CHROME_PATH. Everything
# persists on the overlay volume, so it survives pod redeploys.
set -euo pipefail
cd "$(dirname "$0")"

if [ -f ".setup-done" ] && [ -d node_modules/@marp-team ]; then
  echo "[setup] already done"; exit 0
fi

echo "[setup] npm install (@modelcontextprotocol/sdk + @marp-team/marp-cli)…"
npm install --no-audit --no-fund --loglevel=error

# Marp needs a full Chromium for PDF/PPTX export. The base image's Playwright
# browser is often incomplete (support files, no `chrome` binary), so ensure one.
if ! ls /root/.cache/ms-playwright/chromium-*/chrome-linux*/chrome >/dev/null 2>&1; then
  echo "[setup] installing Chromium for Marp PDF/PPTX (~115MB, once)…"
  npx --yes playwright@latest install chromium >/dev/null 2>&1 \
    && echo "[setup] chromium ready" \
    || echo "[setup] chromium install failed — HTML export still works, PDF/PPTX may not"
fi

mkdir -p "${DECKS_ROOT:-/app/data/decks}"
touch ".setup-done"
echo "[setup] done — deck-studio ready (themes: $(ls themes/*.css 2>/dev/null | wc -l) bundled)."
