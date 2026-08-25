#!/usr/bin/env node
// apply-identity.mjs — apply the cloned bot's NAME + DESCRIPTION via the Bot API.
//
//   node scripts/apply-identity.mjs           # reads src/funnels/cloned.identity.json
//
// Sets: setMyName (display name), setMyDescription (the "What can this bot do?" text
// shown before /start), setMyShortDescription (profile blurb). The AVATAR can NOT be
// set through the Bot API — there is no setMyPhoto; it must be set in @BotFather.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");

function env(name) {
  try {
    const txt = readFileSync(resolve(root, ".env"), "utf8");
    const m = txt.match(new RegExp("^" + name + "=(.*)$", "m"));
    return process.env[name] || (m ? m[1].trim().replace(/^["']|["']$/g, "") : null);
  } catch { return process.env[name] || null; }
}

const token = env("BOT_TOKEN");
if (!token) { console.error("no BOT_TOKEN in .env"); process.exit(1); }
const id = JSON.parse(readFileSync(resolve(root, "src/funnels/cloned.identity.json"), "utf8"));

async function call(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const j = await r.json();
  console.log(`${j.ok ? "✓" : "✗"} ${method}${j.ok ? "" : ": " + j.description}`);
  return j.ok;
}

if (id.name) await call("setMyName", { name: id.name.slice(0, 64) });
if (id.about) {
  await call("setMyDescription", { description: id.about.slice(0, 512) });
  await call("setMyShortDescription", { short_description: id.about.slice(0, 120) });
}
console.log(id.avatar
  ? `\n⚠ avatar ${id.avatar}: set it in @BotFather → Edit Bot → Edit Botpic (Bot API can't).`
  : "\n(no avatar captured)");
