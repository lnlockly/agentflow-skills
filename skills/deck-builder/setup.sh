#!/usr/bin/env bash
# setup.sh — deck-builder prep. The heavy install (Marp CLI + MCP SDK) lives in
# the deck-studio skill's own setup.sh, run when its MCP is registered. Here we
# just ensure the decks workspace exists.
set -euo pipefail
mkdir -p "${DECKS_ROOT:-/app/data/decks}"
echo "[setup] deck-builder ready."
