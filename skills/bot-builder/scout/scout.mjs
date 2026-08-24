#!/usr/bin/env node
/**
 * scout.mjs — the bot-cloning SCOUT. Using the user's OWN userbot session
 * (MTProto), it walks a target bot like a real user: sends /start, reads each
 * screen (text + buttons), clicks callback buttons breadth-first, and records
 * the whole flow as a map. The agent then WRITES a grammY bot that replicates it.
 *
 *   node scout.mjs @targetbot > flow-map.json
 *
 * Env (opt-in — the user activates their userbot; never hardcode):
 *   TG_API_ID, TG_API_HASH      — from my.telegram.org
 *   TG_SESSION                  — StringSession of the user's account
 *   SCOUT_DEPTH (default 4)     — how deep to click
 *   SCOUT_MAX_NODES (default 60)
 *
 * LIMITS (be honest): reconstructs the FLOW + content (screens, buttons, media
 * captions) — that IS the product for most funnels. It cannot see a bot's closed
 * backend logic, payments, or content behind auth/payment walls.
 */
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { createHash } from "node:crypto";

const target = process.argv[2];
if (!target) { console.error("usage: node scout.mjs @targetbot"); process.exit(2); }

const apiId = Number(process.env.TG_API_ID);
const apiHash = process.env.TG_API_HASH;
const session = process.env.TG_SESSION;
const DEPTH = Number(process.env.SCOUT_DEPTH ?? 4);
const MAX_NODES = Number(process.env.SCOUT_MAX_NODES ?? 60);
if (!apiId || !apiHash || !session) { console.error("need TG_API_ID / TG_API_HASH / TG_SESSION"); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hash = (s) => createHash("sha1").update(s || "").digest("hex").slice(0, 12);

/** Extract text + inline buttons from a message. */
function screenOf(msg) {
  const text = msg?.message ?? "";
  const buttons = [];
  const rm = msg?.replyMarkup;
  if (rm?.rows) {
    for (const row of rm.rows) {
      for (const b of row.buttons ?? []) {
        if (b.className === "KeyboardButtonCallback") buttons.push({ text: b.text, kind: "callback", data: b.data });
        else if (b.className === "KeyboardButtonUrl") buttons.push({ text: b.text, kind: "url", url: b.url });
        else buttons.push({ text: b.text, kind: "other" });
      }
    }
  }
  const media = msg?.media ? msg.media.className : null;
  return { text, buttons, media, msgId: msg?.id };
}

async function lastFromBot(client, entity) {
  const msgs = await client.getMessages(entity, { limit: 1 });
  return msgs?.[0] ?? null;
}

async function main() {
  const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 3 });
  await client.connect();
  const entity = await client.getEntity(target);

  const nodes = {}; // hash -> screen
  const edges = []; // { from, button, to }
  const seen = new Set();
  let count = 0;

  await client.sendMessage(entity, { message: "/start" });
  await sleep(1500);
  let root = screenOf(await lastFromBot(client, entity));
  const rootKey = hash(root.text);
  nodes[rootKey] = root;
  seen.add(rootKey);

  // BFS over callback buttons.
  const queue = [{ key: rootKey, depth: 0 }];
  while (queue.length && count < MAX_NODES) {
    const { key, depth } = queue.shift();
    if (depth >= DEPTH) continue;
    const screen = nodes[key];
    for (const btn of screen.buttons) {
      if (btn.kind !== "callback") { edges.push({ from: key, button: btn.text, to: btn.kind === "url" ? `url:${btn.url}` : "external" }); continue; }
      try {
        const msg = await client.getMessages(entity, { ids: screen.msgId });
        await msg?.[0]?.click({ data: btn.data });
        await sleep(1400);
        const next = screenOf(await lastFromBot(client, entity));
        const nk = hash(next.text);
        if (!nodes[nk]) { nodes[nk] = next; count++; }
        edges.push({ from: key, button: btn.text, to: nk });
        if (!seen.has(nk)) { seen.add(nk); queue.push({ key: nk, depth: depth + 1 }); }
      } catch (e) {
        edges.push({ from: key, button: btn.text, to: "error", error: String(e).slice(0, 80) });
      }
    }
  }

  await client.disconnect();
  console.log(JSON.stringify({ target, root: rootKey, nodes, edges }, null, 2));
}

main().catch((e) => { console.error("scout failed:", e); process.exit(1); });
