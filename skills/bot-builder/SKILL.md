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
2. **Show a VISUAL funnel first (interactive canvas, not a rough sketch).** Author
   the funnel as `public/funnel.json` — `{ "screens": [ {id, title, stage, text,
   buttons:[{label, to}]} ] }` (stage ∈ hook|value|cta|nurture|tariffs|other; a
   button with no `to` is a terminal action). The boilerplate already ships a
   polished, self-contained `public/funnel-canvas.html` (pan + zoom + fit, styled
   nodes) that renders that JSON — **use it as-is, don't hand-roll a page.** Copy
   it to `public/index.html`, then publish/expose `public/` and give the user the
   link to approve/tweak BEFORE you write bot code. The canvas is the plan; the
   bot code is the truth.
3. **Get a token — the user's, or mint one YOURSELF for an instant result.** If the
   user has a `BOT_TOKEN`, use it. If not (or they want it done for them), create the
   bot via @BotFather with the userbot account so you can hand back a *working* bot at
   once: `python3 scout/botfather.py --session "$TG_SESSION" --proxy "$SCOUT_PROXY"
   --name "<name>" --username-base <base> [--about "…"] [--avatar assets/target-avatar.jpg]
   --out botfather-result.json`.
   It talks to @BotFather (`/newbot`, picks a free username), and — the only way to set
   a bot photo — uploads the **avatar via `/setuserpic`**. The token lands in the
   out-file (a SECRET — keep it in the pod, never print it). **THEN say honestly:**
   *«бот создан под купленным аккаунтом и уже работает; для полного владения создай
   своего в @BotFather и просто замени `BOT_TOKEN` — больше ничего не изменится».*
4. **Scaffold.** Copy `boilerplate/` to a new folder (e.g. `/app/data/bots/<name>`),
   set `BOT_TOKEN` (+ `DATABASE_URL=file:./data/bot.db`) in `.env`,
   `npm install && npm run db:push`.
5. **Write the funnel as CODE.** Edit `src/funnels/<name>.ts` — a grammY
   `conversations` function, and point `src/funnels/active.ts` at it (the single
   switch point — `bot.ts` never changes). Simple flow ≈ 20 lines; branches / API
   calls / payments / dynamic content = just more code. NO JSON funnels. Reuse the
   feature modules: `features/referral`, `tracking`, `broadcast`, `analytics`.
6. **Run it in your pod** (survives restarts): `pm2 start "npm start" --name <name>`
   `&& pm2 save`. Tell the user the bot is live.
7. **Manage by chat.** You are the admin — no web panel. Prefer the **bot-admin
   MCP tools** (registered by setup.sh): `list_bots`, `bot_stats(dir)`,
   `bot_referrals(dir)`, `bot_broadcast(dir, text, segment?)` — first-class,
   typed, work across every bot you built (scaffold bots into `/app/data/bots/`).
   Fallback / anything custom: run the bot's `tsx src/manage.ts stats|referrals|
   broadcast` or query Prisma (`src/db.ts`) directly. Report results in chat.

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

## Clone an existing bot (SCOUT — you do it all yourself)
The user gives you a target (e.g. `@SystemFlowBot`) and says "make me one like this".
You are a **следопыт (tracker)**: you get your own userbot, walk the whole funnel,
copy identity + flow + content, and rebuild it as code. You do every step — the
user only approves and picks what to change.

**0. Get a userbot account + a country-matched proxy — YOURSELF (account-marketplace MCP).**
   - `market_search({category:'telegram', spam:'no', pmax})` — pick a clean account
     (quality clean, no spam-block, right country, fresh). Show it + ask consent.
   - `market_buy({itemId, confirm:true, attachProxy:true})` — buys it (**spend ≤ $2**)
     and **auto-attaches a residential proxy of the account's own country**, so the
     session's IP matches the account (a different country = drop → the proxy geo must
     equal the account country). ⚠ WITHOUT a matching proxy the account can be flagged.
   - `account_session({id})` — returns a **ready Telethon session string** (through the
     attached proxy). That's what the scout consumes — no auth_key handling on your side.
   - Hygiene: `account_flag` the account if it hits a spam-block or gets logged out.
   - Run `scout/setup.sh` once (installs telethon). *(Legacy fallback: `--account
     <json>` derives the session from the raw `login` auth_key + dc itself.)*

**1. PHASE 1 — walk + copy identity (immediate).**
   ```bash
   python3 scout/scout.py @target --session "$TG_SESSION" --proxy "$SCOUT_PROXY" \
       --media meta --out flow-map.json
   ```
   It sends `/start` and does a **stateful breadth-first walk**, capturing each
   screen (text + buttons + media meta) and copying **identity**: name, `about`,
   avatar. Feed `flow-map.json` into the **funnel-builder** (nodes→screens,
   edges→buttons) and show the user the visual canvas immediately.

   **Know these funnel realities (a good scout expects them):**
   - **A screen is a BURST, not one message.** Funnels stream several bubbles with
     "typing…" delays; the CTA button is on the last one. The scout waits for the
     burst to go quiet, joins the text, and keeps buttons from every bubble.
   - **Funnels are STATEFUL.** After you click one button the state moves on, so you
     can't just click a sibling button to explore the other branch. To map branches
     the scout **resets with `/start` and replays the path** (re-clicking the same
     labels on fresh buttons — callback data changes every session) before trying an
     unexplored button. That's why a thorough walk is slow.
   - **Some bots DON'T reset** — they remember progress in their own DB, so `/start`
     doesn't return to the top. The scout detects this and falls back to a single
     **linear** pass; the other branches simply can't be reached from outside.
   - **`BOT_RESPONSE_TIMEOUT` on a click is harmless** — the bot just didn't ack the
     callback; the funnel still advances. The scout ignores it.
   - **`--budget <sec>` / `--depth` / `--max-nodes`** bound the walk; it saves
     `--out` incrementally so a mid-walk disconnect still leaves a partial map.

**2. READ the `coverage` block and be HONEST with the user.** Every `flow-map.json`
   carries `coverage: { reset_supported, complete, unreached[], notes[] }`. Before
   you present the clone, TELL the user plainly what you got and what you didn't:
   - `complete:false` or a non-empty `unreached[]` → say which buttons/branches you
     couldn't walk and why (bot doesn't reset / hit time budget / dead-end), and
     offer to try deeper (bigger `--budget`/`--depth`), ask them for the missing
     content, or clone only what's reachable. **Never present a partial map as if it
     were the whole funnel.**
   - `reset_supported:false` → explain the target remembers progress, so only one
     path was captured; ask which branch matters or gather the rest manually.

**3. Offer: replace something OR copy fully.** Show the map and ask what to keep vs
   change (name, texts, buttons, branding) — default is faithful copy.

**4. PHASE 2 — drip follow-ups (over time, ASK first).** Many funnels send delayed
   messages (5 min / 1 h / next day). Ask the user *"wait to capture the follow-up
   series? for how long?"* — if yes, run with `--drip-minutes <N>`; the captured
   `drip[]` (each with `delaySec`) becomes scheduled sends in the clone.

**5. Media policy — DON'T burn proxy traffic.** Default `--media meta`: text +
   buttons always, but photos/videos/docs are **metadata + note only, no bytes**.
   If the funnel leans on media, ASK the user before downloading (`--media photos`
   for small photos, `--media all` only on explicit OK). Videos are never auto-pulled.

**6. Rebuild as code — AUTOMATED by clone-build.** Scaffold a bot from `boilerplate/`,
   then generate the funnel straight from the map:
   ```bash
   node scripts/clone-build.mjs <flow-map.json>   # writes src/funnels/cloned.ts + flips active.ts
   node scripts/apply-identity.mjs                 # sets name + description via Bot API
   npm run db:push && pm2 start "npm start" --name <name> && pm2 save
   ```
   `clone-build` turns the flow-map into a real grammY conversation (each screen →
   its message burst, buttons → inline keyboard, edges → branch routing, `drip[]` →
   delayed follow-ups) and switches the bot to it via `src/funnels/active.ts` — one
   switch point, `bot.ts` untouched. It's PLAIN CODE: open `cloned.ts` and edit
   anything, especially screens the scout left as dead-ends (a non-reset target's
   unreached branches). It also prints the `coverage` warnings — relay them (step 2).
   **Avatar:** `apply-identity` sets name/description, but the Bot API has **no way to
   set a bot's photo** — tell the user to set the copied `assets/target-avatar.jpg`
   in **@BotFather → Edit Botpic**. You reconstruct flow + content — that IS the
   product; closed backend logic behind pay/auth walls isn't visible from outside.

The account creds are the user's, bought on their wallet; keep them in
`/app/data/scout/`, never hardcode, never commit.

## Test a bot you built (userbot walks it) — `scripts/test-bot.mjs`
Verify a bot you just shipped by WALKING it with the userbot and diffing against the
funnel you intended (your own grammY bots DO reset on /start, so the full graph is
walkable):
```bash
node scripts/test-bot.mjs @yourbot --account /app/data/scout/account-<id>.json \
     --expect <flow-map.json> --scout ../scout/scout.py
```
It reports PASS/FAIL per screen (every screen reachable, buttons wired) and exits
non-zero on any gap. Also confirm lead capture via the bot-admin MCP (`bot_stats`
should show the test user). Report the result to the user honestly.

## Remember the user
Save the user's bots, brand, default funnel style, audience segments, and any
templates they like to memory — and reuse them by default next time.
