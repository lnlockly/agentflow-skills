# AgentFlow Bot Boilerplate

Generic Telegram-bot base the **agent scaffolds bots from**. Copy this folder,
edit the funnel + config, run it in the pod. Referral, link-tracking, broadcast
and analytics are already here; you write the bot's own logic as **code**.

## Stack (all ready-made — no hand-rolled SQL/SDK)
- **grammY** — Telegram framework (sessions, conversations, runner)
- **Prisma** — ORM. **Swap SQLite → Postgres by changing one line** in
  `prisma/schema.prisma` (`provider`) + `DATABASE_URL`. Zero code changes.
- **zod** — env validation

## What's built in (generic, reusable)
- `features/referral.ts` — deep-link ref codes, attribution, leaderboard
- `features/tracking.ts` — UTM/deep-link clicks + funnel conversions
- `features/broadcast.ts` — segmented, rate-limited mailing (`segments.*` helpers)
- `features/analytics.ts` — growth + funnel stats
- `funnels/welcome.ts` — **example funnel as code** (the pattern you copy)

## Funnels are CODE, not JSON
A funnel is a normal async function using grammY `conversations`. Simple flow =
~20 lines; branches / API calls / payments / dynamic content = just more code.
No JSON DSL, no ceiling. Register new funnels in `src/bot.ts`.

## Run (in the agent's pod)
```bash
cp .env.example .env          # set BOT_TOKEN
npm install
npm run db:push               # create the SQLite DB from the schema
npm start                     # long-polling
```

## The agent is the admin (no web panel)
The agent manages the bot by chat via the CLI:
```bash
tsx src/manage.ts stats                       # users, conversions, sources, links
tsx src/manage.ts referrals                   # top inviters
tsx src/manage.ts broadcast "Акция 🔥" vip     # mailing (optional tag segment)
```
For anything custom, the agent just queries Prisma (`src/db.ts`) or edits the code.

## Move to Postgres later
1. `prisma/schema.prisma`: `provider = "postgresql"`
2. `.env`: `DATABASE_URL="postgresql://…"`
3. `npm run db:push`
Done — no other changes.
