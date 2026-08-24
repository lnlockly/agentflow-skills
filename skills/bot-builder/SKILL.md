---
name: bot-builder
description: Create, run and fully manage Telegram bots for the user — funnel bots, referral/broadcast bots, or clones of an existing bot. Use whenever the user wants a bot built, changed, launched, or managed (stats, mailing, referral). You WRITE CODE and run it in your own pod; you are the admin (no web panel).
---

# Bot Builder — «Собери бота»

You build the user a **real Telegram bot**, run it inside your own pod, and manage
it by chat. You WRITE CODE — a generic boilerplate does the boring parts (users,
referral, link-tracking, broadcast, analytics); you write the bot's own logic and
funnels as code. Everything is editable and grows with the user.

A ready boilerplate ships with this skill at **`boilerplate/`** (grammY + Prisma +
feature modules + an example funnel). You scaffold each new bot by copying it.

## When to use
The user wants to make a bot, change a bot, launch it, or manage one (see stats,
send a broadcast, set up referrals, clone another bot).

## The flow (be DYNAMIC — plan first, don't just build)

1. **Understand + PLAN.** Briefly ask what the bot is for (funnel / shop / community /
   giveaway…), the goal, the vibe. Recall the user's past bots/brand from memory.
2. **Show a VISUAL funnel first.** Draw the funnel as a diagram (a mermaid flowchart
   or a simple numbered map: /start → приветствие → оффер → кнопки → оплата → апселл)
   and show it to the user to approve/tweak BEFORE you write code. This is the
   funnel-builder step — the diagram is the plan, the code is the truth.
3. **Scaffold.** Copy `boilerplate/` to a new folder (e.g. `/app/data/bots/<name>`),
   set `BOT_TOKEN` (+ `DATABASE_URL=file:./data/bot.db`) in `.env`,
   `npm install && npm run db:push`.
4. **Write the funnel as CODE.** Edit `src/funnels/<name>.ts` — a grammY
   `conversations` function. Simple flow ≈ 20 lines; branches / API calls / payments /
   dynamic content = just more code. Register it in `src/bot.ts`. NO JSON funnels.
   Reuse the feature modules: `features/referral`, `tracking`, `broadcast`, `analytics`.
5. **Run it in your pod** (survives restarts): `pm2 start "npm start" --name <name>`
   `&& pm2 save`. Tell the user the bot is live.
6. **Manage by chat.** You are the admin — no web panel. Use the CLI:
   `tsx src/manage.ts stats` · `tsx src/manage.ts referrals` ·
   `tsx src/manage.ts broadcast "текст" [tag]`. For anything custom, query Prisma
   (`src/db.ts`) or edit the code. Report results in chat.

## Rules (the canon)
- **Propose the plan (visual funnel) first** — never silently build.
- **Funnels are CODE**, not JSON. No DSL, no ceiling.
- **Never hand-write SQL** — always the Prisma ORM. SQLite now; to move to Postgres,
  change `provider` in `prisma/schema.prisma` + `DATABASE_URL` — nothing else.
- **The agent is the admin** — manage by chat, not a web dashboard.
- **Run bots in your pod** with pm2 + `pm2 save` so they persist across restarts.

## Referral / tracking / broadcast (already built in)
- Referral: users share `t.me/<bot>?start=ref_<code>`; attribution is automatic.
  `/ref` shows a user their link + invite count.
- Link tracking: campaign links `t.me/<bot>?start=utm_<source>_<campaign>` are recorded;
  `manage stats` shows sources/clicks.
- Broadcast: `broadcast(bot, text, segment)` — `segments.notConverted("purchase")`,
  `segments.withTag("vip")`, `segments.fromSource("instagram")`, or all.

## Clone an existing bot (scout — opt-in)
If the user activates their userbot account, you can clone a target bot:
```bash
cd scout && npm install
TG_API_ID=… TG_API_HASH=… TG_SESSION=… node scout.mjs @targetbot > flow-map.json
```
`scout.mjs` walks the bot with the user's MTProto session (sends /start, clicks
every callback button breadth-first) and outputs a **flow map** (nodes = screens
with text+buttons, edges = button→next). You then READ `flow-map.json` and WRITE
an equivalent grammY funnel with this boilerplate. You reconstruct the flow +
content — that IS the product for most funnels; closed backend logic / content
behind pay/auth walls isn't visible from outside. Userbot creds are opt-in, come
from the user, and live only in env (never hardcode).

## Remember the user
Save the user's bots, brand, default funnel style, audience segments, and any
templates they like to memory — and reuse them by default next time.
