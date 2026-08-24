#!/usr/bin/env node
/**
 * bot-admin MCP — thin, first-class tools so the agent can VIEW live data and
 * manage the bots it built, without parsing a CLI. It wraps each bot's own
 * `src/manage.ts` (which talks to that bot's Prisma DB) — one source of truth,
 * no duplicated queries. Registered per-agent as a stdio MCP.
 *
 * Tools:
 *   list_bots()                          — bot projects the agent has scaffolded
 *   bot_stats(dir)                       — users, conversions, sources, link clicks
 *   bot_referrals(dir)                   — referral leaderboard
 *   bot_broadcast(dir, text, segment?)   — send a mailing (optional tag segment)
 *
 * BOTS_ROOT env (default /app/data/bots) is scanned by list_bots; any absolute
 * `dir` with src/manage.ts also works.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const BOTS_ROOT = process.env.BOTS_ROOT || "/app/data/bots";

const isBot = (dir) => existsSync(join(dir, "src", "manage.ts"));

function runManage(dir, args) {
  const d = resolve(dir);
  if (!isBot(d)) throw new Error(`not a bot project (no src/manage.ts): ${d}`);
  const out = execFileSync("npx", ["tsx", "src/manage.ts", ...args], {
    cwd: d,
    timeout: 120_000,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    env: process.env,
  });
  return out.trim();
}

const TOOLS = [
  { name: "list_bots", description: "List the Telegram bots the agent has built (projects under BOTS_ROOT).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "bot_stats", description: "Live stats for a bot: total/new users, conversions by type, acquisition sources, link clicks.",
    inputSchema: { type: "object", properties: { dir: { type: "string", description: "bot project dir" } }, required: ["dir"], additionalProperties: false } },
  { name: "bot_referrals", description: "Referral leaderboard for a bot (top inviters).",
    inputSchema: { type: "object", properties: { dir: { type: "string" } }, required: ["dir"], additionalProperties: false } },
  { name: "bot_broadcast", description: "Send a broadcast/mailing to a bot's users. Optional `segment` = a user tag; omit for all.",
    inputSchema: { type: "object", properties: { dir: { type: "string" }, text: { type: "string" }, segment: { type: "string" } }, required: ["dir", "text"], additionalProperties: false } },
];

const server = new Server({ name: "bot-admin", version: "0.1.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: a = {} } = req.params;
  const text = (t) => ({ content: [{ type: "text", text: t }] });
  try {
    switch (name) {
      case "list_bots": {
        if (!existsSync(BOTS_ROOT)) return text(JSON.stringify({ root: BOTS_ROOT, bots: [] }));
        const bots = readdirSync(BOTS_ROOT)
          .map((n) => join(BOTS_ROOT, n))
          .filter((p) => statSync(p).isDirectory() && isBot(p))
          .map((p) => ({ dir: p, name: p.split("/").pop(), hasDb: existsSync(join(p, "data", "bot.db")) }));
        return text(JSON.stringify({ root: BOTS_ROOT, bots }, null, 2));
      }
      case "bot_stats": return text(runManage(a.dir, ["stats"]));
      case "bot_referrals": return text(runManage(a.dir, ["referrals"]));
      case "bot_broadcast": return text(runManage(a.dir, ["broadcast", String(a.text), ...(a.segment ? [String(a.segment)] : [])]));
      default: return { content: [{ type: "text", text: `unknown tool: ${name}` }], isError: true };
    }
  } catch (e) {
    return { content: [{ type: "text", text: `error: ${e.message || e}` }], isError: true };
  }
});

await server.connect(new StdioServerTransport());
