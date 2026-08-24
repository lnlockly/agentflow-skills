#!/usr/bin/env node
/**
 * deck-studio — a per-agent stdio MCP server: DISCRETE tools to build premium
 * presentations. NO fixed pipeline — the AGENT (guided by the deck-builder
 * SKILL) researches with its OWN web tools, writes the deck as Marp markdown,
 * generates/finds images with these tools, picks a theme, and exports.
 *
 * Ready-made everywhere:
 *   export        → Marp CLI (@marp-team/marp-cli) → HTML + PDF + PPTX, one source
 *   themes        → bundled ready themes (themes/*.css) + Marp built-ins; the user
 *                   drops their OWN <name>.css into themes/ and it just appears
 *   generate_image→ gpt-image-2 via the pod gateway   (same call video-studio uses)
 *   search_stock  → Pexels                            (same call video-studio uses)
 *
 * Env: OPENAI_BASE_URL/OPENAI_API_KEY (gateway), PEXELS_API_KEY (optional),
 *      DECKS_ROOT (default /app/data/decks), BROWSER_EXECUTABLE/CHROME_PATH (marp).
 *
 * A deck = a folder under DECKS_ROOT: <deck>/deck.md + <deck>/assets/ + <deck>/out/.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const THEMES_DIR = join(HERE, "themes");
const DECKS_ROOT = process.env.DECKS_ROOT || "/app/data/decks";
const BUILTINS = ["default", "gaia", "uncover"];

const llmGateway = () => {
  let base = (process.env.OPENAI_BASE_URL || process.env.LLM_BASE_URL || "").replace(/\/$/, "");
  if (base && !/\/v1$/.test(base)) base += "/v1";
  return { base, key: process.env.OPENAI_API_KEY || process.env.LLM_KEY };
};
const deckDirOf = (d) => {
  if (!d) throw new Error("deckDir is required");
  const p = isAbsolute(d) ? d : join(DECKS_ROOT, d);
  mkdirSync(join(p, "assets"), { recursive: true });
  mkdirSync(join(p, "out"), { recursive: true });
  return p;
};

// ── generate_image (gpt-image-2) ────────────────────────────────────────────
async function tool_generate_image({ prompt, deckDir, name, size = "1536x1024", model = "gpt-image-2" }) {
  const { base, key } = llmGateway();
  if (!base || !key) throw new Error("no OpenAI gateway (OPENAI_BASE_URL + OPENAI_API_KEY)");
  if (!prompt) throw new Error("prompt is required");
  const dir = deckDirOf(deckDir);
  const id = name || `gen-${createHash("sha1").update(prompt).digest("hex").slice(0, 10)}`;
  const res = await fetch(`${base}/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, prompt, n: 1, size }),
  });
  if (!res.ok) throw new Error(`images/generations ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const item = (await res.json())?.data?.[0];
  const outPath = join(dir, "assets", `${id}.png`);
  if (item?.b64_json) writeFileSync(outPath, Buffer.from(item.b64_json, "base64"));
  else if (item?.url) writeFileSync(outPath, Buffer.from(await (await fetch(item.url)).arrayBuffer()));
  else throw new Error("images/generations returned neither b64_json nor url");
  return { ok: true, path: outPath, rel: `assets/${id}.png` };
}

// ── search_stock (Pexels) ───────────────────────────────────────────────────
async function tool_search_stock({ query, deckDir, name, orientation = "landscape" }) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error("PEXELS_API_KEY is not set");
  if (!query) throw new Error("query is required");
  const dir = deckDirOf(deckDir);
  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("orientation", orientation);
  url.searchParams.set("per_page", "15");
  url.searchParams.set("size", "large");
  const res = await fetch(url, { headers: { Authorization: key } });
  if (!res.ok) throw new Error(`Pexels ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const photos = (await res.json()).photos || [];
  if (!photos.length) throw new Error(`Pexels returned 0 photos for "${query}"`);
  const pick = photos[createHash("sha1").update(query).digest()[0] % photos.length];
  const dl = pick.src?.large2x || pick.src?.original || pick.src?.large;
  const id = name || `stock-${createHash("sha1").update(query).digest("hex").slice(0, 10)}`;
  const outPath = join(dir, "assets", `${id}.jpg`);
  writeFileSync(outPath, Buffer.from(await (await fetch(dl)).arrayBuffer()));
  return { ok: true, path: outPath, rel: `assets/${id}.jpg`, credit: pick.photographer, creditUrl: pick.url };
}

// ── search_image (Wikimedia Commons — REAL, public-domain / CC photos) ───────
// The right tool for real-world & HISTORICAL topics: actual archival photos with
// attribution + license. Prefer this over generate_image whenever a real image
// exists (a WWII photo should be REAL, never fabricated).
async function tool_search_image({ query, deckDir, name }) {
  if (!query) throw new Error("query is required");
  const dir = deckDirOf(deckDir);
  const api = new URL("https://commons.wikimedia.org/w/api.php");
  Object.entries({
    action: "query", format: "json", generator: "search", gsrsearch: query,
    gsrnamespace: "6", gsrlimit: "12", prop: "imageinfo",
    iiprop: "url|extmetadata|mime|size", iiurlwidth: "1600",
  }).forEach(([k, v]) => api.searchParams.set(k, v));
  const res = await fetch(api, { headers: { "User-Agent": "AgentFlow-DeckBuilder/1.0 (agentflow.website)" } });
  if (!res.ok) throw new Error(`Wikimedia ${res.status}`);
  const pages = Object.values((await res.json())?.query?.pages || {});
  // Prefer real raster photos (jpg/png), skip svg/icons/tiny.
  const cand = pages
    .map((p) => ({ p, ii: p.imageinfo?.[0] }))
    .filter((x) => x.ii && /image\/(jpeg|png)/.test(x.ii.mime || "") && (x.ii.width || 0) >= 600);
  if (!cand.length) throw new Error(`no usable Commons image for "${query}"`);
  const { p, ii } = cand[0];
  const dl = ii.thumburl || ii.url;
  const id = name || `img-${createHash("sha1").update(query).digest("hex").slice(0, 10)}`;
  const outPath = join(dir, "assets", `${id}.jpg`);
  writeFileSync(outPath, Buffer.from(await (await fetch(dl, { headers: { "User-Agent": "AgentFlow-DeckBuilder/1.0" } })).arrayBuffer()));
  const meta = ii.extmetadata || {};
  const strip = (h) => (h ? String(h).replace(/<[^>]+>/g, "").trim() : undefined);
  return {
    ok: true, path: outPath, rel: `assets/${id}.jpg`,
    credit: strip(meta.Artist?.value), license: meta.LicenseShortName?.value,
    source: p.title, sourceUrl: ii.descriptionurl,
  };
}

// ── list_themes ─────────────────────────────────────────────────────────────
function tool_list_themes() {
  const custom = existsSync(THEMES_DIR)
    ? readdirSync(THEMES_DIR).filter((f) => f.endsWith(".css")).map((f) => {
        const head = readFileSync(join(THEMES_DIR, f), "utf8").slice(0, 400);
        const m = head.match(/@theme\s+([a-z0-9_-]+)/i);
        return { name: m ? m[1] : f.replace(/\.css$/, ""), file: f };
      })
    : [];
  return {
    builtins: BUILTINS,
    bundled: custom,
    note: "Set `theme:` in the deck frontmatter (or pass theme to build_deck). Drop your own <name>.css into themes/ to add a custom one.",
    themesDir: THEMES_DIR,
  };
}

// ── build_deck (Marp → HTML + PDF + PPTX) ───────────────────────────────────
function tool_build_deck({ deckDir, markdown, theme = "aurora", name = "deck" }) {
  const dir = deckDirOf(deckDir);
  const mdPath = join(dir, "deck.md");
  if (markdown) writeFileSync(mdPath, markdown);
  if (!existsSync(mdPath)) throw new Error(`no deck.md in ${dir} (pass markdown or create deck.md)`);

  const env = { ...process.env };
  const chrome = process.env.BROWSER_EXECUTABLE || process.env.CHROME_PATH;
  if (chrome) env.CHROME_PATH = chrome;

  const outs = {};
  for (const [fmt, flag] of [["html", "--html"], ["pdf", "--pdf"], ["pptx", "--pptx"]]) {
    const out = join(dir, "out", `${name}.${fmt}`);
    try {
      execFileSync("npx", [
        "@marp-team/marp-cli", mdPath,
        "--theme-set", THEMES_DIR,
        "--theme", theme,
        "--allow-local-files",
        flag, "-o", out,
      ], { cwd: dir, env, timeout: 300_000, stdio: ["ignore", "pipe", "pipe"] });
      outs[fmt] = out;
    } catch (e) {
      outs[fmt] = `FAILED: ${String(e.stderr || e.message).slice(0, 200)}`;
    }
  }
  return { ok: true, deckDir: dir, theme, outputs: outs };
}

// ── MCP wiring ──────────────────────────────────────────────────────────────
const TOOLS = [
  { name: "list_themes", description: "List available deck themes (bundled ready themes + Marp built-ins). The user can add their own by dropping a <name>.css into themes/.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "generate_image", description: "Generate an image with gpt-image-2 for a slide (cover, section, illustration). Landscape by default. Returns {path, rel} — reference it in markdown as ![bg](assets/<name>.png) or ![](assets/<name>.png).",
    inputSchema: { type: "object", properties: { prompt: { type: "string" }, deckDir: { type: "string" }, name: { type: "string" }, size: { type: "string", description: "1536x1024 (landscape, default), 1024x1024, or 1024x1536" } }, required: ["prompt", "deckDir"], additionalProperties: false } },
  { name: "search_image", description: "Find a REAL photo on Wikimedia Commons (public-domain / CC, with attribution). USE THIS FIRST for real-world & historical topics — a real photo (e.g. a WWII archival image) must be real, never generated. Returns {path, rel, credit, license, sourceUrl}.",
    inputSchema: { type: "object", properties: { query: { type: "string" }, deckDir: { type: "string" }, name: { type: "string" } }, required: ["query", "deckDir"], additionalProperties: false } },
  { name: "search_stock", description: "Find a modern stock photo on Pexels (business/lifestyle/nature). For real-world/historical, prefer search_image. Returns {path, rel, credit}. Requires PEXELS_API_KEY.",
    inputSchema: { type: "object", properties: { query: { type: "string" }, deckDir: { type: "string" }, name: { type: "string" }, orientation: { type: "string" } }, required: ["query", "deckDir"], additionalProperties: false } },
  { name: "build_deck", description: "Build the presentation from Marp markdown into HTML + PDF + PPTX at once. Pass `markdown` (or have deck.md in deckDir), a `theme` (see list_themes) and `name`. Returns the 3 output paths.",
    inputSchema: { type: "object", properties: { deckDir: { type: "string" }, markdown: { type: "string" }, theme: { type: "string" }, name: { type: "string" } }, required: ["deckDir"], additionalProperties: false } },
];

const server = new Server({ name: "deck-studio", version: "0.1.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: a = {} } = req.params;
  const ok = (o) => ({ content: [{ type: "text", text: JSON.stringify(o, null, 2) }] });
  try {
    switch (name) {
      case "list_themes": return ok(tool_list_themes());
      case "generate_image": return ok(await tool_generate_image(a));
      case "search_image": return ok(await tool_search_image(a));
      case "search_stock": return ok(await tool_search_stock(a));
      case "build_deck": return ok(tool_build_deck(a));
      default: return { content: [{ type: "text", text: `unknown tool: ${name}` }], isError: true };
    }
  } catch (e) {
    return { content: [{ type: "text", text: `error: ${e.message || e}` }], isError: true };
  }
});
await server.connect(new StdioServerTransport());
