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
  const token = process.env.MARKET_TOKEN;
  if (!base || !token) {
    throw new Error('media tools unavailable (CP_SELF_URL/MARKET_URL + MARKET_TOKEN not set)');
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

// ===========================================================================
// MCP wiring
// ===========================================================================
const TOOLS = [
  {
    name: 'list_ai_video_models',
    description: 'List available AI text-to-video models (grok/veo/omni) with resolutions + per-second token cost. Call before generate_ai_video to pick a model the owner can afford.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'generate_ai_video',
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
    name: 'ai_video_status',
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
    name: 'speak',
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
    name: 'list_voices',
    description: 'List the available TTS voices + per-character token cost.',
    inputSchema: { type: 'object', properties: {} },
  },
];

const HANDLERS = {
  list_ai_video_models: () => tool_list_ai_video_models(),
  generate_ai_video: (a) => tool_generate_ai_video(a),
  ai_video_status: (a) => tool_ai_video_status(a),
  speak: (a) => tool_speak(a),
  list_voices: () => tool_list_voices(),
};

const server = new Server(
  { name: 'agent-media', version: '1.0.0' },
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
