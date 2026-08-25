#!/usr/bin/env node
// test-bot.mjs — QA a bot you built by WALKING it with the userbot and diffing the
// result against the funnel you intended.
//
//   node scripts/test-bot.mjs @yourclonebot --account /app/data/scout/account.json \
//        --expect ../scout/flow-map.json --scout ../scout/scout.py [--proxy socks5://…]
//
// It runs the same scout against your OWN bot (grammY bots DO reset on /start, so the
// full graph is walkable), then compares screens + buttons to the expected map and
// prints PASS/FAIL per screen. Non-zero exit if anything is missing — usable in CI.
import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const pos = args.filter((a) => !a.startsWith("--"));
const opt = (n, d) => { const i = args.indexOf("--" + n); return i >= 0 ? args[i + 1] : d; };
const target = pos[0];
const account = opt("account");
const expectPath = opt("expect");
const scout = opt("scout", "../scout/scout.py");
const python = opt("python", "python3");
if (!target || !account || !expectPath) {
  console.error("usage: test-bot.mjs @bot --account acc.json --expect flow-map.json [--scout scout.py] [--proxy …]");
  process.exit(2);
}

const norm = (s) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 60);
const screensOf = (m) => Object.values(m.nodes || {}).map((n) => ({
  t: norm(n.text),
  btns: (n.buttons || []).filter((b) => b.kind === "callback").map((b) => b.text),
}));

const expect = JSON.parse(readFileSync(expectPath, "utf8"));

// walk the clone fresh
const out = join(mkdtempSync(join(tmpdir(), "qa-")), "actual.json");
const proxy = opt("proxy");
const sa = [scout, target, "--account", account, "--media", "meta", "--depth", "10", "--max-nodes", "30", "--budget", "220", "--out", out];
if (proxy) sa.push("--proxy", proxy);
console.log(`walking ${target} …`);
const r = spawnSync(python, sa, { stdio: ["ignore", "inherit", "inherit"] });
if (r.status !== 0) { console.error("scout failed"); process.exit(1); }
const actual = JSON.parse(readFileSync(out, "utf8"));

// diff: every EXPECTED screen must appear in ACTUAL with the same button labels
const act = screensOf(actual);
let pass = 0, fail = 0;
for (const e of screensOf(expect)) {
  const hit = act.find((a) => a.t === e.t || (e.t && a.t.startsWith(e.t.slice(0, 30))));
  const missBtns = hit ? e.btns.filter((b) => !hit.btns.includes(b)) : e.btns;
  if (hit && missBtns.length === 0) { pass++; console.log(`  ✓ ${e.t.slice(0, 50)}`); }
  else { fail++; console.log(`  ✗ ${e.t.slice(0, 50)} ${hit ? "— missing buttons: " + missBtns.join(", ") : "— screen NOT reached"}`); }
}
console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} ok / ${fail} problems (expected ${pass + fail} screens)`);
console.log(`Tip: also check lead capture via the bot-admin MCP (bot_stats) — the test user should appear.`);
process.exit(fail === 0 ? 0 : 1);
