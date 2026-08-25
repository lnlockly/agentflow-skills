#!/usr/bin/env python3
"""
scout.py — the bot-cloning SCOUT (следопыт). Uses the OWNER's userbot account
(bought on the marketplace, delivered as auth_key+dc — NOT tdata) to walk a
target bot like a real user and map its funnel for cloning.

The AGENT runs this — it already bought the account (market_buy) and rented a
proxy (proxy_rent). This script just needs the account creds + a proxy.

  python3 scout.py @targetbot --account account.json --proxy socks5://user:pass@host:port \
      [--drip-minutes 0] [--media meta|photos|all] [--depth 4] > flow-map.json

WHY telethon: LZT telegram accounts come as {telegram_dc_id, login=<256-byte
auth_key hex>, app_id, app_hash}. Telethon builds a live MTProto session from a
DC + auth_key directly — no tdata conversion. Proxy keeps the IP consistent + US.

MEDIA POLICY (saves proxy traffic — residential is metered):
  meta   (default) — text+buttons always; photos/videos/docs = metadata only
                     (type, caption, size, duration) + tiny thumbnail. No bytes.
  photos           — also download small photos.
  all              — download everything (heavy — only on the owner's explicit ok).
"""
import sys, json, re, asyncio, argparse, hashlib, os, time

try:
    from telethon import TelegramClient, events
    from telethon.sessions import StringSession
    from telethon.crypto import AuthKey
    from telethon.tl import types
    from telethon.tl.functions.messages import GetBotCallbackAnswerRequest
    from telethon.tl.functions.users import GetFullUserRequest
except Exception as e:
    print(json.dumps({"error": f"telethon not installed: {e}. run setup.sh"}))
    sys.exit(2)

# Prod DC IPs (telethon falls back to these; set explicitly for reliability).
DC_IPS = {1: "149.154.175.53", 2: "149.154.167.51", 3: "149.154.175.100",
          4: "149.154.167.91", 5: "91.108.56.130"}

def load_account(path):
    """Robustly pull creds from the LZT account JSON (tolerates messy control
    chars in the seller banner by regex-extracting the fields we need)."""
    raw = open(path, "r", encoding="utf-8", errors="replace").read()
    def field(name):
        m = re.search(r'"%s"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"' % name, raw)
        return m.group(1) if m else None
    def num(name):
        # value may be a bare number OR a quoted string (LZT sends "telegram_dc_id":"1")
        m = re.search(r'"%s"\s*:\s*"?(\d+)"?' % name, raw)
        return int(m.group(1)) if m else None
    # The credential IS the auth_key: `login` (== loginData.raw) is a 256-byte hex
    # MTProto auth_key. app_id/app_hash default to the Telegram Desktop pair LZT
    # autoreg accounts are made with (proven: authorizes on the account's own DC).
    login = field("login")
    tj = {}
    tjs = field("telegram_json")
    if tjs:
        try: tj = json.loads(tjs.encode().decode("unicode_escape"))
        except Exception: tj = {}
    return {
        "auth_key_hex": login,
        "dc_id": tj.get("dc_id") or num("telegram_dc_id") or 2,
        "app_id": tj.get("app_id") or 2040,
        "app_hash": tj.get("app_hash") or "b18441a1ff607e10a989891a5462e627",
    }

def parse_proxy(url):
    if not url: return None
    m = re.match(r'socks5://(?:([^:]+):([^@]+)@)?([^:]+):(\d+)', url)
    if not m: return None
    import socks
    user, pw, host, port = m.groups()
    return (socks.SOCKS5, host, int(port), True, user, pw) if user else (socks.SOCKS5, host, int(port))

def make_client(acc, proxy):
    ss = StringSession()
    ss.set_dc(acc["dc_id"], DC_IPS.get(acc["dc_id"], DC_IPS[2]), 443)
    ss.auth_key = AuthKey(data=bytes.fromhex(acc["auth_key_hex"]))
    return TelegramClient(ss, acc["app_id"], acc["app_hash"], proxy=proxy)

def media_of(msg, policy):
    """Media summary. Heavy media → META ONLY unless policy allows bytes."""
    if not msg.media: return None
    m = msg.media
    if isinstance(m, types.MessageMediaPhoto):
        kind = "photo"; heavy = False
    elif isinstance(m, types.MessageMediaDocument):
        doc = m.document
        mime = getattr(doc, "mime_type", "") or ""
        kind = "video" if "video" in mime else ("audio" if "audio" in mime else "document")
        heavy = kind in ("video", "audio", "document")
    else:
        kind = type(m).__name__; heavy = True
    return {"kind": kind, "heavy": heavy, "note": "meta-only (proxy traffic saved)" if heavy and policy == "meta" else "downloadable"}

def buttons_of(msg):
    """Buttons on one message, each tagged with its parent msg_id (needed to click)."""
    out = []
    rm = getattr(msg, "reply_markup", None)
    if not rm or not hasattr(rm, "rows"):
        return out
    for row in rm.rows:
        for b in row.buttons:
            if isinstance(b, types.KeyboardButtonCallback):
                out.append({"text": b.text, "kind": "callback", "data": b.data.hex(), "msg_id": msg.id})
            elif isinstance(b, types.KeyboardButtonUrl):
                out.append({"text": b.text, "kind": "url", "url": b.url, "msg_id": msg.id})
            else:
                out.append({"text": getattr(b, "text", "?"), "kind": "other", "msg_id": msg.id})
    return out

def screen_of(msgs, policy):
    """A screen = the whole BURST of bot messages after one action. Joins their
    text, collects buttons from every bubble (the CTA is usually on the last)."""
    if not isinstance(msgs, list):
        msgs = [msgs]
    msgs = [m for m in msgs if m is not None]
    text = "\n\n".join((m.message or "").strip() for m in msgs if (m.message or "").strip())
    buttons, media = [], []
    for m in msgs:
        buttons += buttons_of(m)
        mm = media_of(m, policy)
        if mm: media.append(mm)
    last_id = msgs[-1].id if msgs else 0
    return {"text": text, "buttons": buttons, "media": media or None, "msg_id": last_id}

async def run(args):
    # Two ways in: a ready Telethon session string from the MCP `account_session`
    # tool (preferred — comes with a country-matched proxy already), or the raw
    # account JSON (we derive the session from its auth_key + dc ourselves).
    if args.session:
        client = TelegramClient(StringSession(args.session), args.app_id, args.app_hash, proxy=parse_proxy(args.proxy))
    else:
        acc = load_account(args.account)
        if not acc["auth_key_hex"]:
            print(json.dumps({"error": "no auth_key (login) in account json"})); return
        client = make_client(acc, parse_proxy(args.proxy))
    await client.connect()
    if not await client.is_user_authorized():
        print(json.dumps({"error": "userbot session not authorized (bad session/auth_key/dc/proxy)"})); return

    entity = await client.get_entity(args.target)
    # --- copy identity: name, about, avatar (small) ---
    full = await client(GetFullUserRequest(entity))
    about = getattr(full.full_user, "about", None)
    identity = {"username": getattr(entity, "username", None),
                "name": getattr(entity, "first_name", None),
                "about": about, "avatar_file": None}
    if getattr(entity, "photo", None):  # avatar is tiny + essential for a clone — always copy
        try:
            os.makedirs("assets", exist_ok=True)
            identity["avatar_file"] = await client.download_profile_photo(entity, file="assets/target-avatar.jpg")
        except Exception:
            pass

    nodes, edges, seen = {}, [], set()
    high = [0]  # highest incoming msg_id already consumed

    async def settle(quiet=3.0, maxwait=18):
        """Collect the BURST of new bot messages after an action until it goes
        quiet (no new message for `quiet` s). Funnels stream several bubbles with
        typing delays; the CTA button is on the last one."""
        got = {}
        t0 = last = time.time()
        while time.time() - t0 < maxwait:
            ms = await client.get_messages(entity, limit=12)
            for m in ms:
                if (not m.out) and m.id > high[0] and m.id not in got:
                    got[m.id] = m; last = time.time()
            if got and (time.time() - last) >= quiet:
                break
            await asyncio.sleep(1.2)
        msgs = [got[i] for i in sorted(got)]
        if msgs: high[0] = msgs[-1].id
        return msgs

    def key(s): return hashlib.sha1((s or "").encode()).hexdigest()[:12]

    drip = []
    rk = None
    # coverage = HONESTY report for the agent to relay to the user.
    coverage = {"reset_supported": None, "complete": True, "unreached": [], "notes": []}
    def emit():
        out = {"target": args.target, "identity": identity, "root": rk, "coverage": coverage,
               "nodes": nodes, "edges": edges, "drip": drip, "mediaPolicy": args.media}
        blob = json.dumps(out, ensure_ascii=False, indent=2)
        if args.out:
            open(args.out, "w", encoding="utf-8").write(blob)   # survives SIGTERM/disconnect
        else:
            print(blob)

    async def click(b):
        # tolerate BOT_RESPONSE_TIMEOUT — the funnel still advances
        try: await client(GetBotCallbackAnswerRequest(peer=entity, msg_id=b["msg_id"], data=bytes.fromhex(b["data"])))
        except Exception: pass

    async def start_screen():
        await client.send_message(entity, "/start")
        return screen_of(await settle(), args.media)

    def cb_uniq(node):
        """Callback buttons of a node, de-duplicated by label (a burst can repeat
        the same CTA across bubbles — the old walk clicked each twice)."""
        seen_l, out = set(), []
        for b in node["buttons"]:
            if b["kind"] == "callback" and b["text"] not in seen_l:
                seen_l.add(b["text"]); out.append(b)
        return out

    def find_btn(scr, label):
        return next((x for x in scr["buttons"] if x["kind"] == "callback" and x["text"] == label), None)

    async def replay(path):
        """Reset via /start, then re-click each label in `path` on FRESH buttons
        (callback data is regenerated every session, so stored data goes stale).
        Returns (status, screen): ok | noreset (bot kept state) | diverged."""
        scr = await start_screen()
        if key(scr["text"]) != rk:
            return "noreset", scr
        for label in path:
            b = find_btn(scr, label)
            if not b: return "diverged", scr
            await click(b)
            scr = screen_of(await settle(), args.media)
        return "ok", scr

    # --- PHASE 1: stateful BFS. To explore a button we RESET (/start) and replay
    # the path to its screen, because the funnel is stateful — you can't click a
    # sibling button after the state has already moved on. ------------------------
    deadline = time.time() + args.budget
    root = await start_screen()
    rk = key(root["text"]); root["path"] = []; nodes[rk] = root; emit()
    queue = [rk]
    while queue and len(nodes) < args.max_nodes and time.time() < deadline:
        node = nodes[queue.pop(0)]
        if len(node["path"]) >= args.depth: continue
        for b in cb_uniq(node):
            if time.time() >= deadline: coverage["complete"] = False; break
            status, scr = await replay(node["path"])
            if status == "noreset":
                # Bot remembers progress across /start → branches can't be isolated.
                coverage["reset_supported"] = False; coverage["complete"] = False
                coverage["notes"].append("Бот не сбрасывается по /start (помнит прогресс) — ветвление не разложить; снимаю один линейный проход.")
                queue = []; break
            if coverage["reset_supported"] is None: coverage["reset_supported"] = True
            if status == "diverged":
                coverage["unreached"].append(b["text"]); coverage["complete"] = False; continue
            fb = find_btn(scr, b["text"])   # the fresh instance of this button
            if not fb:
                coverage["unreached"].append(b["text"]); coverage["complete"] = False; continue
            k = key(node["text"])
            await click(fb)
            nxt = screen_of(await settle(), args.media); nk = key(nxt["text"])
            if not nxt["text"] and not nxt["buttons"]:
                edges.append({"from": k, "button": b["text"], "to": "no-response"}); coverage["complete"] = False; continue
            if nk not in nodes:
                nxt["path"] = node["path"] + [b["text"]]; nodes[nk] = nxt; queue.append(nk)
            edges.append({"from": k, "button": b["text"], "to": nk}); emit()
        # url/external buttons — record without walking
        for b in node["buttons"]:
            if b["kind"] != "callback":
                edges.append({"from": key(node["text"]), "button": b["text"],
                              "to": ("url:" + b.get("url", "")) if b["kind"] == "url" else "external"})

    # --- PHASE 1b: linear fallback when the bot ignores /start (no reset). Can only
    # follow ONE path; other branches are honestly reported as unreached. ----------
    if coverage["reset_supported"] is False:
        scr = await start_screen(); ck = key(scr["text"])
        if ck not in nodes: scr["path"] = []; nodes[ck] = scr
        steps = 0
        while steps < args.depth and time.time() < deadline:
            cbs = cb_uniq(nodes[ck])
            if not cbs: break
            if len(cbs) > 1: coverage["unreached"] += [x["text"] for x in cbs[1:]]
            b = cbs[0]; await click(b)
            nxt = screen_of(await settle(), args.media); nk = key(nxt["text"])
            reached = bool(nxt["text"] or nxt["buttons"])
            edges.append({"from": ck, "button": b["text"], "to": nk if reached else "no-response"})
            if not reached: break
            if nk not in nodes: nxt["path"] = nodes[ck]["path"] + [b["text"]]; nodes[nk] = nxt
            ck = nk; steps += 1; emit()

    if queue: coverage["complete"] = False  # hit max_nodes / deadline with work left
    coverage["unreached"] = sorted(set(coverage["unreached"]))

    # --- PHASE 2: drip follower (wait for scheduled follow-ups over time) ---
    if args.drip_minutes > 0:
        t0 = time.time()
        @client.on(events.NewMessage(from_users=entity))
        async def _h(ev):
            drip.append({"delaySec": int(time.time() - t0), **screen_of(ev.message, args.media)})
            emit()
        await asyncio.sleep(args.drip_minutes * 60)

    emit()
    try: await client.disconnect()
    except Exception: pass

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("target")
    ap.add_argument("--account", default=None, help="LZT account JSON (derive session from auth_key)")
    ap.add_argument("--session", default=os.environ.get("TG_SESSION"), help="ready Telethon StringSession from MCP account_session (preferred)")
    ap.add_argument("--app-id", type=int, default=2040)
    ap.add_argument("--app-hash", default="b18441a1ff607e10a989891a5462e627")
    ap.add_argument("--proxy", default=os.environ.get("SCOUT_PROXY"))
    ap.add_argument("--drip-minutes", type=int, default=0)
    ap.add_argument("--media", choices=["meta", "photos", "all"], default="meta")
    ap.add_argument("--depth", type=int, default=4)
    ap.add_argument("--max-nodes", type=int, default=60)
    ap.add_argument("--budget", type=int, default=220, help="wall-clock seconds for the walk")
    ap.add_argument("--out", default=None, help="write flow-map here incrementally (else stdout at end)")
    a = ap.parse_args()
    if not a.session and not a.account:
        print(json.dumps({"error": "need --session (from MCP account_session) or --account <json>"})); sys.exit(2)
    asyncio.run(run(a))
