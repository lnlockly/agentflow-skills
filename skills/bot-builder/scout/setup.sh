#!/usr/bin/env bash
# setup.sh — one-time prep for the SCOUT (bot cloner). Installs the MTProto stack
# (telethon + PySocks). Idempotent + latched; the pip site-packages survive pod
# restarts via the agent's DATA-PVC overlay on /usr. Run once before scouting.
set -euo pipefail
cd "$(dirname "$0")"
if [ -f ".setup-done" ] && python3 -c "import telethon, socks" 2>/dev/null; then
  echo "[scout] telethon already installed"; exit 0
fi
echo "[scout] pip install telethon + PySocks…"
python3 -m pip install --quiet --disable-pip-version-check -r requirements.txt
touch ".setup-done"
echo "[scout] ready — python3 scout.py @target --account <acc.json> --proxy socks5://…"
