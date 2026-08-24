---
name: bot-studio
description: MCP server (bot-admin) for the bot-builder agent — first-class tools to view and manage the Telegram bots it created. Installed as an MCP via the bot-builder template's `mcp:` block, not used directly.
---

# bot-studio (MCP host)

This skill exists only to ship the **bot-admin MCP server** (`mcp-server.mjs`).
The bot-builder template references it in `install.mcp` (with `env.BOTS_ROOT`), so
the generic agent entrypoint fetches it, runs `setup.sh`, and registers it via
`hermes mcp add`. You don't invoke this skill directly — you call its tools.

Tools exposed to the agent:
- `list_bots()` — the bots the agent has scaffolded (under `BOTS_ROOT`, default `/app/data/bots`)
- `bot_stats(dir)` — users, conversions, acquisition sources, link clicks
- `bot_referrals(dir)` — referral leaderboard
- `bot_broadcast(dir, text, segment?)` — send a mailing (optional tag segment)

Each tool wraps the target bot's own `src/manage.ts` (Prisma → the bot's SQLite),
so there is one source of truth and no duplicated queries.
