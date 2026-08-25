#!/usr/bin/env python3
"""
botfather.py — create a READY bot via @BotFather using the userbot account, so the
agent can hand the user a working bot instantly. Also sets the bot's name, about and
AVATAR through BotFather (the /setuserpic flow — the one way to set a bot photo).

  python3 botfather.py --account acc.json --name "Деньги на коротких видео" \
      --username-base moneyshorts [--about "..."] [--avatar assets/target-avatar.jpg] \
      [--proxy socks5://…] --out botfather-result.json

⚠ OWNERSHIP: the bot is created under the BOUGHT userbot account, not the user's own
Telegram. It works immediately, but the agent MUST tell the user: for full ownership,
create your own bot in @BotFather and just swap BOT_TOKEN — nothing else changes.

Writes {ok, username, token, name, avatar_set, note} to --out (the token is a SECRET
— keep it in the pod, never print it to chat).
"""
import sys, os, re, json, asyncio, argparse, random, string

try:
    from telethon import TelegramClient
    from telethon.sessions import StringSession
    from telethon.crypto import AuthKey
except Exception as e:
    print(json.dumps({"ok": False, "error": f"telethon missing: {e}"})); sys.exit(2)

# reuse the scout account loader + proxy parsing
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scout import load_account, parse_proxy, DC_IPS

BF = "BotFather"
TOKEN_RE = re.compile(r"(\d{6,}:[A-Za-z0-9_\-]{30,})")

def slug(s):
    s = re.sub(r"[^a-z0-9_]", "", (s or "").lower())
    return s or "my"

def candidates(base):
    base = slug(base)[:20].rstrip("_")
    yield base + "bot"
    yield base + "_bot"
    for _ in range(8):
        suf = "".join(random.choices(string.digits, k=3))
        yield f"{base}{suf}bot"

async def main(args):
    # ready session from MCP account_session (preferred), or derive from account JSON
    if args.session:
        client = TelegramClient(StringSession(args.session), args.app_id, args.app_hash, proxy=parse_proxy(args.proxy))
    else:
        acc = load_account(args.account)
        ss = StringSession(); ss.set_dc(acc["dc_id"], DC_IPS.get(acc["dc_id"], DC_IPS[2]), 443)
        ss.auth_key = AuthKey(data=bytes.fromhex(acc["auth_key_hex"]))
        client = TelegramClient(ss, acc["app_id"], acc["app_hash"], proxy=parse_proxy(args.proxy))
    await client.connect()
    if not await client.is_user_authorized():
        print(json.dumps({"ok": False, "error": "userbot not authorized"})); return

    result = {"ok": False, "username": None, "token": None, "name": args.name, "avatar_set": False}
    async with client.conversation(BF, timeout=40) as conv:
        await conv.send_message("/newbot")
        await conv.get_response()                       # "choose a name"
        await conv.send_message(args.name)
        r = await conv.get_response()                   # "choose a username"
        token = None; username = None
        for cand in candidates(args.username_base or args.name):
            await conv.send_message(cand)
            r = await conv.get_response()
            t = TOKEN_RE.search(r.raw_text or "")
            if t:                                       # success
                token = t.group(1); username = cand; break
            # else taken/invalid → the loop tries the next candidate
        if not token:
            print(json.dumps({"ok": False, "error": "could not secure a username", "last": (r.raw_text or "")[:200]})); await client.disconnect(); return
        result.update(ok=True, username=username, token=token)

        # about / description (best-effort)
        if args.about:
            try:
                await conv.send_message("/setdescription")
                await conv.get_response(); await conv.send_message("@" + username)
                await conv.get_response(); await conv.send_message(args.about[:512])
                await conv.get_response()
            except Exception: pass

        # AVATAR via /setuserpic — the ONLY way to set a bot photo (Bot API can't)
        if args.avatar and os.path.exists(args.avatar):
            try:
                await conv.send_message("/setuserpic")
                await conv.get_response(); await conv.send_message("@" + username)
                await conv.get_response()
                await conv.send_file(args.avatar)
                rr = await conv.get_response()
                result["avatar_set"] = "Success" in (rr.raw_text or "") or "updated" in (rr.raw_text or "").lower()
            except Exception: pass

    await client.disconnect()
    result["note"] = ("Бот создан под КУПЛЕННЫМ аккаунтом. Работает сразу, но для полного "
                      "владения создай своего бота в @BotFather и просто замени BOT_TOKEN.")
    blob = json.dumps(result, ensure_ascii=False, indent=2)
    if args.out: open(args.out, "w", encoding="utf-8").write(blob)
    # print without the token to stdout; token stays in --out file
    safe = dict(result); safe["token"] = ("<%d chars, in %s>" % (len(result["token"]), args.out)) if result["token"] else None
    print(json.dumps(safe, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--account", default=None, help="LZT account JSON (derive session)")
    ap.add_argument("--session", default=os.environ.get("TG_SESSION"), help="ready Telethon StringSession from MCP account_session")
    ap.add_argument("--app-id", type=int, default=2040)
    ap.add_argument("--app-hash", default="b18441a1ff607e10a989891a5462e627")
    ap.add_argument("--name", required=True)
    ap.add_argument("--username-base", default=None)
    ap.add_argument("--about", default=None)
    ap.add_argument("--avatar", default=None)
    ap.add_argument("--proxy", default=os.environ.get("SCOUT_PROXY"))
    ap.add_argument("--out", default="botfather-result.json")
    asyncio.run(main(ap.parse_args()))
