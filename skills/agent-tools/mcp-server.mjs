#!/usr/bin/env node
/**
 * agent-media — the DEFAULT media MCP server every AgentFlow agent gets.
 *
 * Design principle: this is the THIN, primitive slice of the media surface — the
 * CP-proxy tools ONLY. It carries NO ffmpeg / whisper / remotion (that heavy
 * render pipeline lives in the `video-studio` template skill). Every tool here
 * calls the Control-Plane as the OWNER (CP_SELF_URL/MARKET_URL + MARKET_TOKEN),
 * so the provider secret key stays server-side and the owner is billed tokens:
 *
 *   generate_ai_video     POST {CP}/v1/me/video/generate    → {requestId,tokensCharged,…}
 *   ai_video_status       GET  {CP}/v1/me/video/{id}        → status; when ready,
 *                         downloads the mp4 from the CP CONTENT-PROXY
 *                         GET {CP}/v1/me/video/{id}/content  (NOT the raw provider url)
 *   list_ai_video_models  GET  {CP}/v1/me/video/models
 *   speak                 POST {CP}/v1/me/tts/speak          → mp3 (base64)
 *   list_voices           GET  {CP}/v1/me/tts/voices
 *
 * Tools return STRUCTURED JSON (as text content). Downloaded media is written to
 * a writable dir ($MEDIA_OUT_DIR, else $HOME/agent-media, else /tmp).
 *
 * Env (injected by the pod entrypoint — the UNIVERSAL creds set):
 *   CP_SELF_URL / MARKET_URL   the CP API base (self-usage / market)
 *   MARKET_TOKEN               the owner's personal API token (bills the owner)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { mkdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { createHash } from 'node:crypto';

const log = (...a) => console.error('[agent-media]', ...a); // stderr — never stdout (MCP framing)

// Writable output dir for downloaded media. The overlay-persisted $HOME survives
// pod restarts; /tmp is the last-resort fallback.
const OUT = (() => {
  const base = process.env.MEDIA_OUT_DIR || join(process.env.HOME || '/tmp', 'agent-media');
  try {
    mkdirSync(base, { recursive: true });
    return base;
  } catch {
    return '/tmp';
  }
})();

/** The CP base + owner token. Every tool bills the owner through this. */
function cpBase() {
  const base = (process.env.CP_SELF_URL || process.env.MARKET_URL || '').replace(/\/+$/, '');
  // ONE owner-scoped CP token for everything (video/tts/market/proxy/wallet).
  // CP_TOKEN is the current name; MARKET_TOKEN is the legacy fallback for pods
  // provisioned before the rename (they keep working until reprovisioned).
  const token = process.env.CP_TOKEN || process.env.MARKET_TOKEN;
  if (!base || !token) {
    throw new Error('CP tools unavailable (CP_SELF_URL + CP_TOKEN not set)');
  }
  return { base, token };
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

// --- AI video generation (anymodel via the CP video proxy) ------------------
async function tool_generate_ai_video({ model, prompt, duration = 8, resolution = '720p', aspect_ratio }) {
  const { base, token } = cpBase();
  if (!prompt) throw new Error('prompt is required');
  if (!model) throw new Error('model is required (see list_ai_video_models)');
  const res = await fetch(`${base}/v1/me/video/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth(token) },
    body: JSON.stringify({ model, prompt, duration, resolution, aspectRatio: aspect_ratio }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`video/generate ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  // { ok, requestId, model, resolution, duration, tokensCharged, balanceTokens }
  return data;
}

async function tool_ai_video_status({ requestId, download = true, out }) {
  const { base, token } = cpBase();
  if (!requestId) throw new Error('requestId is required');
  // 1) Poll the provider status (through CP — never the raw provider).
  const res = await fetch(`${base}/v1/me/video/${encodeURIComponent(requestId)}`, {
    headers: auth(token),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`video/status ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  const job = data?.job ?? data;
  // Heuristic readiness across common provider shapes (also try the download —
  // the CP content-proxy is the source of truth: 200 = ready, else pending).
  const hasUrl = !!(
    job?.url || job?.video_url || job?.output_url || job?.result?.url ||
    job?.output?.[0]?.url || job?.data?.[0]?.url || job?.assets?.[0]?.url
  );
  const status = String(job?.status ?? job?.state ?? '');
  const ready = hasUrl || /succeed|success|complete|done|ready|finish/i.test(status);

  if (download) {
    // 2) Download the finished mp4 from the CP CONTENT-PROXY (owner-authorized;
    //    the anymodel server key stays inside CP). NOT the raw provider url.
    const bin = await fetch(`${base}/v1/me/video/${encodeURIComponent(requestId)}/content`, {
      headers: auth(token),
    });
    if (bin.ok) {
      const id = `ai-${createHash('sha1').update(requestId).digest('hex').slice(0, 10)}`;
      const outPath = out ? (isAbsolute(out) ? out : join(OUT, out)) : join(OUT, `${id}.mp4`);
      writeFileSync(outPath, Buffer.from(await bin.arrayBuffer()));
      return { ok: true, status: 'ready', path: outPath, job };
    }
    // Download was requested but the content-proxy did not serve bytes yet → the
    // content-proxy is the source of truth, so report 'pending' (never claim 'ready'
    // without a written file, even if the provider status string looked done).
    return { ok: true, status: 'pending', job };
  }
  return { ok: true, status: ready ? 'ready' : 'pending', job };
}

async function tool_list_ai_video_models() {
  const { base, token } = cpBase();
  const res = await fetch(`${base}/v1/me/video/models`, { headers: auth(token) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`video/models ${res.status}`);
  return data; // { ok, models:[{id, resolutions, ratesPerSecond, aspectFormat, durations}] }
}

// --- TTS (edge-tts via the CP proxy) ----------------------------------------
async function tool_speak({ text, voice = 'edge-tts/ru-RU-SvetlanaNeural', out }) {
  const { base, token } = cpBase();
  if (!text) throw new Error('text is required');
  const model = /^edge-tts\//.test(voice) ? voice : `edge-tts/${voice}`;
  const res = await fetch(`${base}/v1/me/tts/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth(token) },
    body: JSON.stringify({ model, input: text }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`tts/speak ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  if (!data.audioBase64) return { ok: false, error: 'no audio returned', meta: data };
  const id = `tts-${createHash('sha1').update(text).digest('hex').slice(0, 10)}`;
  const outPath = out ? (isAbsolute(out) ? out : join(OUT, out)) : join(OUT, `${id}.mp3`);
  writeFileSync(outPath, Buffer.from(data.audioBase64, 'base64'));
  return { ok: true, path: outPath, chars: data.chars, tokensCharged: data.tokensCharged, balanceTokens: data.balanceTokens };
}

async function tool_list_voices() {
  const { base, token } = cpBase();
  const res = await fetch(`${base}/v1/me/tts/voices`, { headers: auth(token) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`tts/voices ${res.status}`);
  return data;
}

// --- MARKET (digital goods / LZT accounts via the CP proxy) ------------------
// Buying spends the OWNER real money — so market_buy REQUIRES an explicit
// confirm:true. Without it, the tool returns the item + price for the agent to
// show the user and ASK; only after the user agrees does the agent call again
// with confirm:true. This is the mandatory purchase-confirmation gate.
async function tool_market_search({ category = 'steam', query, pmin, pmax, page }) {
  const { base, token } = cpBase();
  const qs = new URLSearchParams({ category });
  if (query) qs.set('q', query);
  if (pmin != null) qs.set('pmin', String(pmin));
  if (pmax != null) qs.set('pmax', String(pmax));
  if (page != null) qs.set('page', String(page));
  const res = await fetch(`${base}/v1/me/market/catalog?${qs}`, { headers: auth(token) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`market/catalog ${res.status}`);
  return data; // { ok, items, available }
}

async function tool_market_item({ id }) {
  const { base, token } = cpBase();
  if (id == null) throw new Error('id is required');
  const res = await fetch(`${base}/v1/me/market/item/${encodeURIComponent(id)}`, { headers: auth(token) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`market/item ${res.status}`);
  return data; // { ok, item }
}

async function tool_market_buy({ itemId, confirm }) {
  const { base, token } = cpBase();
  if (itemId == null) throw new Error('itemId is required');
  // MANDATORY confirmation: never spend the owner's money on the first call.
  if (confirm !== true) {
    const info = await tool_market_item({ id: itemId }).catch(() => ({}));
    return {
      ok: false,
      needsConfirmation: true,
      item: info.item ?? { id: itemId },
      message: 'Покупка спишет реальные деньги владельца. Покажи товар и цену пользователю, спроси согласие, затем вызови market_buy повторно с confirm:true.',
    };
  }
  const res = await fetch(`${base}/v1/me/market/buy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth(token) },
    body: JSON.stringify({ itemId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`market/buy ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return data; // { ok, orderId, credentials, chargedUsd }
}

async function tool_market_orders() {
  const { base, token } = cpBase();
  const res = await fetch(`${base}/v1/me/market/orders`, { headers: auth(token) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`market/orders ${res.status}`);
  return data; // { ok, orders }
}

// --- PROXY (residential proxy rental via the CP proxy) -----------------------
async function tool_proxy_list() {
  const { base, token } = cpBase();
  const res = await fetch(`${base}/v1/me/proxies`, { headers: auth(token) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`proxies ${res.status}`);
  return data; // { ok, proxies, gbUsed, cap, count }
}

async function tool_proxy_rent({ country = 'US', sticky = false }) {
  const { base, token } = cpBase();
  const res = await fetch(`${base}/v1/me/proxies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth(token) },
    body: JSON.stringify({ country, sticky }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`proxy rent ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return data; // { ok, proxy creds }
}

async function tool_proxy_release({ leaseId }) {
  const { base, token } = cpBase();
  if (!leaseId) throw new Error('leaseId is required');
  const res = await fetch(`${base}/v1/me/proxies/${encodeURIComponent(leaseId)}`, {
    method: 'DELETE',
    headers: auth(token),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`proxy release ${res.status}`);
  return data;
}

// ===========================================================================
// MCP wiring
// ===========================================================================
const TOOLS = [
  {
    name: 'video_models',
    description: 'List available AI text-to-video models (grok/veo/omni) with resolutions + per-second token cost. Call before generate_ai_video to pick a model the owner can afford.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'video_generate',
    description: 'Generate a REAL AI text-to-video clip (grok/veo/omni via the platform). Charges the owner tokens = duration×quality (checked first; 402 if low balance). Async: returns {requestId, tokensCharged, balanceTokens}; then poll ai_video_status.',
    inputSchema: {
      type: 'object',
      properties: {
        model: { type: 'string', description: 'Model id from list_ai_video_models, e.g. xai/grok-imagine-video-1.5, flow/veo-3.1.' },
        prompt: { type: 'string', description: 'What the video should show.' },
        duration: { type: 'number', description: 'Seconds. grok: 1-15; flow/omni: 4/6/8/10; flow/veo: 8.' },
        resolution: { type: 'string', description: '480p | 720p | 1080p (per the model).' },
        aspect_ratio: { type: 'string', description: '16:9 or 9:16 (mapped to landscape/portrait for flow models).' },
      },
      required: ['model', 'prompt'],
    },
  },
  {
    name: 'video_status',
    description: 'Poll an AI video job by requestId. When ready, downloads the mp4 from the platform content-proxy and returns {status:"ready", path}. While rendering returns {status:"pending"}.',
    inputSchema: {
      type: 'object',
      properties: {
        requestId: { type: 'string', description: 'The id from generate_ai_video.' },
        download: { type: 'boolean', description: 'Download the mp4 when ready (default true).' },
        out: { type: 'string', description: 'Optional output path/name.' },
      },
      required: ['requestId'],
    },
  },
  {
    name: 'tts_speak',
    description: 'Text-to-speech (AI voiceover) via the platform. Billed per character to the owner. Returns {path} to an mp3. Voices: edge-tts/<voice>, e.g. edge-tts/ru-RU-SvetlanaNeural, edge-tts/ru-RU-DmitryNeural, edge-tts/en-US-AriaNeural.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The text to speak.' },
        voice: { type: 'string', description: 'edge-tts voice id, e.g. edge-tts/ru-RU-SvetlanaNeural (default) or edge-tts/en-US-AriaNeural.' },
        out: { type: 'string', description: 'Optional output path/name.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'market_search',
    description: 'Search the digital-goods marketplace (LZT accounts: steam, social, etc.). Prices already include markup, in USD. Returns {items}. Use before market_buy.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'e.g. steam, social, gaming (default steam).' },
        query: { type: 'string', description: 'Optional title filter.' },
        pmin: { type: 'number', description: 'Min price USD.' },
        pmax: { type: 'number', description: 'Max price USD.' },
        page: { type: 'number' },
      },
    },
  },
  {
    name: 'market_item',
    description: 'Get one marketplace item by id (our price).',
    inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
  },
  {
    name: 'market_buy',
    description: 'Buy a marketplace item — spends the OWNER real money. FIRST call it WITHOUT confirm to get the item+price, SHOW it to the user and ASK for agreement; only then call again with confirm:true. On success returns {orderId, credentials, chargedUsd}.',
    inputSchema: {
      type: 'object',
      properties: {
        itemId: { type: 'number' },
        confirm: { type: 'boolean', description: 'Must be true to actually buy — set only after the user explicitly agreed.' },
      },
      required: ['itemId'],
    },
  },
  {
    name: 'market_orders',
    description: 'List the owner past purchases (with delivered credentials).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'proxy_list',
    description: 'List the owner active residential proxies (creds), GB used and the cap.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'proxy_rent',
    description: 'Rent a residential proxy in a country (for a userbot/scraping). Returns connection creds. Metered per GB to the owner.',
    inputSchema: {
      type: 'object',
      properties: {
        country: { type: 'string', description: 'ISO country, e.g. US, DE, RU (default US).' },
        sticky: { type: 'boolean', description: 'Sticky session (same IP) vs rotating. Default false.' },
      },
    },
  },
  {
    name: 'proxy_release',
    description: 'Release a rented proxy by leaseId (frees a slot).',
    inputSchema: { type: 'object', properties: { leaseId: { type: 'string' } }, required: ['leaseId'] },
  },
  {
    name: 'tts_voices',
    description: 'List the available TTS voices + per-character token cost.',
    inputSchema: { type: 'object', properties: {} },
  },
];

const HANDLERS = {
  video_models: () => tool_list_ai_video_models(),
  video_generate: (a) => tool_generate_ai_video(a),
  video_status: (a) => tool_ai_video_status(a),
  tts_speak: (a) => tool_speak(a),
  tts_voices: () => tool_list_voices(),
  market_search: (a) => tool_market_search(a),
  market_item: (a) => tool_market_item(a),
  market_buy: (a) => tool_market_buy(a),
  market_orders: () => tool_market_orders(),
  proxy_list: () => tool_proxy_list(),
  proxy_rent: (a) => tool_proxy_rent(a),
  proxy_release: (a) => tool_proxy_release(a),
};

const server = new Server(
  { name: 'agent-tools', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  const handler = HANDLERS[name];
  if (!handler) {
    return { isError: true, content: [{ type: 'text', text: JSON.stringify({ ok: false, error: `unknown tool ${name}` }) }] };
  }
  try {
    const result = await handler(args);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  } catch (e) {
    log(`tool ${name} error:`, e?.message || e);
    return { isError: true, content: [{ type: 'text', text: JSON.stringify({ ok: false, error: String(e?.message || e) }) }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
log(`ready. out=${OUT}`);
