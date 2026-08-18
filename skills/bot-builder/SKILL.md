---
name: bot-builder
description: "Scaffold a working Telegram bot with python-telegram-bot — command handlers, inline keyboards, message flows, and deploy notes. Self-contained; the Bot API token comes from BotFather, no third-party service."
version: 1.0.0
author: AgentFlow
license: MIT
platforms: [linux, macos]
metadata:
  hermes:
    tags: [telegram, bot, python, python-telegram-bot, handlers, inline-keyboard, ptb, бот]
    related_skills: [funnel-builder, publish]
---

# Bot Builder — Scaffold a Working Telegram Bot

You build a runnable Telegram bot using **python-telegram-bot** (PTB, v21+,
async). Everything here uses code and your runtime only. The single external
dependency is the Telegram Bot API itself, which is inherent to any Telegram bot
and reached with a token the user obtains from **@BotFather** — no MCP, no
third-party wrapper.

---

## Step 0 — Get the token (tell the user, once)

The user creates the bot in Telegram: message **@BotFather** → `/newbot` →
choose a name and username → BotFather returns a token like
`123456:ABC-DEF...`. Never hardcode it. Read it from the `BOT_TOKEN` environment
variable.

## Step 1 — Project layout

```
mybot/
  bot.py            # entry point, wires handlers
  handlers.py       # command + callback handlers
  keyboards.py      # inline keyboard builders
  flows.py          # message flow / screen definitions (maps to funnel.json)
  requirements.txt  # python-telegram-bot>=21
```

`requirements.txt`:
```
python-telegram-bot>=21,<22
```

Install: `pip install -r requirements.txt`.

## Step 2 — Command handlers

```python
# handlers.py
from telegram import Update
from telegram.ext import ContextTypes
from keyboards import main_menu

async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Welcome! Pick an option:",
        reply_markup=main_menu(),
    )

async def help_cmd(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Commands: /start /help")
```

Register a handler for every command you expose, and set the command list so
Telegram shows the menu:

```python
await app.bot.set_my_commands([
    ("start", "Begin"),
    ("help", "How this bot works"),
])
```

## Step 3 — Inline keyboards

```python
# keyboards.py
from telegram import InlineKeyboardButton, InlineKeyboardMarkup

def main_menu():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("Start free", callback_data="cta")],
        [InlineKeyboardButton("I have a question", callback_data="nurture")],
    ])
```

`callback_data` is the routing key. Keep it short (<64 bytes) and stable.

## Step 4 — Message flows (screens → callbacks)

If a funnel was designed with the `funnel-builder` skill, `funnel.json` already
lists screens and buttons. Turn each screen into a render function and route
callbacks by the button's `to` id:

```python
# flows.py
SCREENS = {
    "cta":     {"text": "Start free — no card.", "buttons": [("Pick a plan","tariffs"),("Question","nurture")]},
    "nurture": {"text": "Free 3-min lesson + FAQ.", "buttons": [("Back","cta")]},
    "tariffs": {"text": "Pick a plan:", "buttons": [("Starter $19","checkout"),("Pro $49","checkout")]},
    "checkout":{"text": "Great! Confirm your plan.", "buttons": []},
}
```

```python
# handlers.py
from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from flows import SCREENS

async def on_button(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()
    screen = SCREENS.get(q.data)
    if not screen:
        return
    kb = [[InlineKeyboardButton(lbl, callback_data=to)] for (lbl, to) in screen["buttons"]]
    await q.edit_message_text(screen["text"],
                              reply_markup=InlineKeyboardMarkup(kb) if kb else None)
```

Editing the message (`edit_message_text`) makes the funnel feel like a single
evolving screen instead of a growing chat log.

## Step 5 — Wire it together

```python
# bot.py
import os
from telegram.ext import ApplicationBuilder, CommandHandler, CallbackQueryHandler
from handlers import start, help_cmd, on_button

def main():
    token = os.environ["BOT_TOKEN"]
    app = ApplicationBuilder().token(token).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_cmd))
    app.add_handler(CallbackQueryHandler(on_button))
    app.run_polling()  # long-polling: no public URL needed

if __name__ == "__main__":
    main()
```

Run: `BOT_TOKEN=123:ABC python bot.py`.

## Step 6 — Deploy notes

- **Polling** (`run_polling`) needs no inbound port — simplest for a container
  or a small VM. One process per bot token; never run two pollers on the same
  token (they will fight for updates).
- **Webhook** (`app.run_webhook(...)`) needs a public HTTPS URL. If the user
  wants that, expose the port with the `publish` skill's frp tunnel and call
  `bot.set_webhook(url)`.
- Keep the token in the environment, not in code or git.
- Persist state (which screen a user is on, purchases) in a small file or
  SQLite if the flow needs memory across restarts; `ContextTypes` user_data is
  in-memory only.
- Handle errors with `app.add_error_handler(...)` so one bad update never kills
  the bot.

## Deliverables

1. A runnable `mybot/` project (the files above, filled for the user's case).
2. The exact run command and where to paste the BotFather token.
3. If a funnel exists, screens wired 1:1 to `funnel.json`.
