#!/usr/bin/env bash
# setup.sh — ONE-TIME env prep for the bot-builder skill, run inside the agent
# pod. Idempotent + latched: safe to call before every job; the heavy work
# (npm install + prisma client generation) runs only once. The agent pod
# overlay-persists /usr /opt /root on the DATA PVC, so node_modules and the
# generated Prisma client SURVIVE pod restarts — paid once per agent.
#
# What it prewarms is the SHARED boilerplate/ (grammY + Prisma + feature
# modules + example funnel). Each bot the agent builds is a COPY of that folder
# with its own .env + DB, so its per-bot `npm install && npm run db:push`
# resolves instantly from this warm cache.
#
# NOT prewarmed here: scout/ (MTProto clone tool). Its GramJS dep + a userbot
# session are opt-in and only needed when the user asks to clone a bot, so the
# SKILL installs it on demand (`cd scout && npm install`).
set -euo pipefail
cd "$(dirname "$0")/boilerplate"

LATCH=".setup-done"
if [ -f "$LATCH" ] && [ -d node_modules/grammy ] && [ -d node_modules/.prisma/client ]; then
  echo "[setup] already done"
  exit 0
fi

echo "[setup] npm install (grammy + @grammyjs/* + @prisma/client + zod + tooling)…"
npm install --no-audit --no-fund --loglevel=error

echo "[setup] prisma generate (typed client from schema.prisma)…"
# generate reads only the schema — no DATABASE_URL/secret needed. The URL is set
# per-bot in each copy's .env before `npm run db:push`.
npx prisma generate >/dev/null

touch "$LATCH"
echo "[setup] done — boilerplate warm. Scaffold a bot: cp -r boilerplate <dst> && cd <dst> && npm run db:push"
