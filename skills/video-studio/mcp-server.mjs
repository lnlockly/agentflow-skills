#!/usr/bin/env node
/**
 * video-studio — a per-agent stdio MCP server exposing DISCRETE video tools.
 *
 * Design principle (READ THIS): this server holds NO director logic and NO
 * fixed pipeline. It is a box of thin, single-purpose tools. The AGENT (guided
 * by SKILL.md) is the director: it looks at what the user sent, decides the
 * style, AUTHORS the storyboard JSON itself, and orchestrates these tools in
 * whatever order the content demands. A meme is not a "разбор"; a 40-min
 * podcast becomes analyze_highlights → cut_clip → face_crop → render_reel.
 *
 * Every heavy asset is REUSED, never reimplemented:
 *   transcribe    → the proven sub.mjs (whisper medium/ru, word timestamps)
 *   render_reel   → the proven Remotion `BrandedReel` composition
 *   generate_image→ gpt-image-2 via the pod's OpenAI-compatible gateway
 *   search_stock  → Pexels (same call fetch-assets.mjs uses)
 *   fetch-assets  → run for ImageInsert scenes before render (proven script)
 * New capability (OpenShorts-level, but as tools the agent chooses):
 *   analyze_highlights → gpt-5.5 picks viral moments from the transcript
 *   cut_clip           → ffmpeg lossless-ish extract of a moment
 *   face_crop          → MediaPipe speaker-tracking 9:16 reframe (scripts/face_crop.py)
 *   send_video         → Telegram Bot API sendVideo with real 9:16 dims + streaming
 *
 * Tools return STRUCTURED JSON (as text content). Long tools (transcribe,
 * render_reel, face_crop) accept `async:true` → return {jobId}; poll job_status.
 * send_video is how a finished reel reaches the user, so the agent never blocks.
 *
 * Env (inherited from the pod, see mcp-config.yaml):
 *   OPENAI_BASE_URL / OPENAI_API_KEY   pod LLM+image gateway (gpt-5.5, gpt-image-2)
 *   PEXELS_API_KEY                     optional stock search
 *   TELEGRAM_BOT_TOKEN                 the bot the pod self-polls with
 *   VIDEO_STUDIO_DIR                   the Remotion project root (proven render)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  statSync,
} from 'node:fs';
import { basename, extname, join, resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// Paths. The Remotion project (package.json + node_modules + src/BrandedReel +
// public/ + sub.mjs + scripts/fetch-assets.mjs) is the "studio". It ships as
// the sibling `video-producer` hub skill; override with VIDEO_STUDIO_DIR.
// ---------------------------------------------------------------------------
const HERE = dirname(fileURLToPath(import.meta.url));

function resolveStudioDir() {
  const candidates = [
    process.env.VIDEO_STUDIO_DIR,
    join(HERE, '..', 'video-producer'),
    join(HERE, 'video-producer'),
    HERE,
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      if (existsSync(join(c, 'package.json')) && existsSync(join(c, 'src', 'index.ts'))) {
        return resolve(c);
      }
    } catch {
      /* ignore */
    }
  }
  // Fall back to the first candidate so error messages are actionable.
  return resolve(candidates[0] || HERE);
}

const STUDIO = resolveStudioDir();
const PUB = join(STUDIO, 'public');
const OUT = join(STUDIO, 'out');
const JOBS = join(HERE, '.jobs');
for (const d of [PUB, OUT, JOBS, join(PUB, 'assets')]) {
  try {
    mkdirSync(d, { recursive: true });
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------
const log = (...a) => console.error('[video-studio]', ...a); // stderr — never stdout (MCP framing)

function slugId(p, fallback = 'reel') {
  const b = basename(String(p || ''), extname(String(p || '')));
  return (b.replace(/[^a-z0-9_-]/gi, '_').slice(0, 40) || fallback);
}

function llmGateway() {
  let base = (process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || process.env.LLM_BASE_URL || '').replace(/\/+$/, '');
  const key = process.env.OPENAI_API_KEY || process.env.LLM_KEY;
  return { base, key };
}

/** Run a child process (cwd defaults to STUDIO). Resolves {code,stdout,stderr}. */
function run(cmd, args, opts = {}) {
  return new Promise((res) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd || STUDIO,
      env: { ...process.env, ...(opts.env || {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('error', (e) => res({ code: -1, stdout: out, stderr: String(e?.message || e) }));
    child.on('close', (code) => res({ code, stdout: out, stderr: err }));
  });
}

async function ffmpeg(args) {
  // @remotion/cli bundles a known-good ffmpeg; guaranteed present in the studio.
  return run('npx', ['remotion', 'ffmpeg', '-y', ...args]);
}
async function ffprobeJson(file) {
  const r = await run('npx', [
    'remotion', 'ffprobe', '-v', 'quiet', '-print_format', 'json',
    '-show_format', '-show_streams', file,
  ]);
  try {
    return JSON.parse(r.stdout);
  } catch {
    return null;
  }
}

async function probe(file) {
  const j = await ffprobeJson(file);
  const v = j?.streams?.find((s) => s.codec_type === 'video');
  const durationMs = Math.round(parseFloat(j?.format?.duration || v?.duration || '0') * 1000) || 0;
  return {
    width: v ? Number(v.width) : null,
    height: v ? Number(v.height) : null,
    durationMs,
    vcodec: v?.codec_name || null,
    hasAudio: !!j?.streams?.find((s) => s.codec_type === 'audio'),
  };
}

/**
 * Normalize any mp4 into a Telegram-safe deliverable: H.264 High + yuv420p,
 * AAC, early keyframe, +faststart. `remux:true` only moves the moov atom
 * (fast; use when codecs are already correct, e.g. Remotion output).
 */
async function normalize(inPath, outPath, { remux = false } = {}) {
  if (remux) {
    const r = await ffmpeg(['-i', inPath, '-c', 'copy', '-movflags', '+faststart', outPath]);
    if (r.code === 0 && existsSync(outPath)) return outPath;
    // fall through to full re-encode on remux failure
  }
  const r = await ffmpeg([
    '-i', inPath,
    '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,format=yuv420p',
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'veryfast',
    '-g', '48', '-keyint_min', '48', '-sc_threshold', '0',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    outPath,
  ]);
  if (r.code !== 0) throw new Error(`normalize ffmpeg failed: ${r.stderr.slice(-400)}`);
  return outPath;
}

// ---------------------------------------------------------------------------
// Job runner — long tools may run async and be polled with job_status.
// ---------------------------------------------------------------------------
const jobs = new Map();
function jobPath(id) {
  return join(JOBS, `${id}.json`);
}
function writeJob(id, state) {
  jobs.set(id, state);
  try {
    writeFileSync(jobPath(id), JSON.stringify(state, null, 2));
  } catch {
    /* ignore */
  }
}
function readJob(id) {
  if (jobs.has(id)) return jobs.get(id);
  try {
    return JSON.parse(readFileSync(jobPath(id), 'utf8'));
  } catch {
    return null;
  }
}
async function maybeAsync(kind, isAsync, fn) {
  if (!isAsync) return await fn();
  const id = `${kind}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  writeJob(id, { jobId: id, kind, status: 'running', startedAt: Date.now() });
  fn()
    .then((result) => writeJob(id, { jobId: id, kind, status: 'done', result, finishedAt: Date.now() }))
    .catch((e) => writeJob(id, { jobId: id, kind, status: 'error', error: String(e?.message || e), finishedAt: Date.now() }));
  return { jobId: id, status: 'running', hint: 'poll job_status(jobId) until status is "done" or "error"' };
}

// ---------------------------------------------------------------------------
// Footage staging — put a file into the Remotion public/ dir as <id>.mp4 so the
// composition can staticFile() it. Optionally mux an external audio track.
// ---------------------------------------------------------------------------
async function stageFootage(video, audio) {
  if (!video || !existsSync(video)) throw new Error(`input video not found: ${video}`);
  const id = slugId(video);
  const dest = join(PUB, `${id}.mp4`);
  if (audio && existsSync(audio)) {
    const r = await ffmpeg(['-i', video, '-i', audio, '-c:v', 'copy', '-c:a', 'aac', '-shortest', dest]);
    if (r.code !== 0) throw new Error(`mux audio failed: ${r.stderr.slice(-300)}`);
  } else if (resolve(video) !== dest) {
    copyFileSync(video, dest);
  }
  return { id, staged: dest, rel: `${id}.mp4` };
}

// ===========================================================================
// TOOL IMPLEMENTATIONS
// ===========================================================================

// --- transcribe ------------------------------------------------------------
async function tool_transcribe({ video, audio }) {
  const { id, rel } = await stageFootage(video, audio);
  const r = await run('node', ['sub.mjs', `public/${rel}`]);
  const capFile = join(PUB, `${id}.json`);
  if (!existsSync(capFile)) {
    throw new Error(`transcription produced no captions. sub.mjs said: ${(r.stderr || r.stdout).slice(-400)}`);
  }
  const captions = JSON.parse(readFileSync(capFile, 'utf8'));
  const transcript = captions.map((c) => (c.text || '').trim()).join(' ').replace(/\s+/g, ' ').trim();
  const durationMs = captions.at(-1)?.endMs || (await probe(join(PUB, rel))).durationMs;
  return {
    ok: true,
    id,
    captionsPath: capFile,
    tokenCount: captions.length,
    durationMs,
    transcript,
    // word-timestamped tokens (input to analyze_highlights / your storyboard timing)
    captions,
  };
}

// --- analyze_highlights ----------------------------------------------------
const HIGHLIGHTS_SYSTEM = `Ты — редактор коротких вертикальных видео. Тебе дают транскрипт (слова с таймингами в мс) длинного видео. Верни СТРОГИЙ JSON: {"highlights":[{"startMs":int,"endMs":int,"title":str,"hook":str,"why":str}]}.
Правила: выбери самые вирусные, самодостаточные моменты (сильный хук в первые секунды, законченная мысль, эмоция или поворот). Каждый момент длится между minSec и maxSec. Сегменты НЕ пересекаются, идут по возрастанию startMs, попадают в границы транскрипта. title — цепляющий заголовок ≤60 симв. hook — первая фраза-крючок. why — почему момент выстрелит. Верни ровно targetCount (или меньше, если материала не хватает). Только JSON.`;

async function tool_analyze_highlights({ transcript, captions, captionsPath, targetCount = 5, minSec = 15, maxSec = 60 }) {
  const { base, key } = llmGateway();
  if (!base || !key) throw new Error('no LLM gateway (OPENAI_BASE_URL + OPENAI_API_KEY)');
  let caps = captions;
  if (!caps && captionsPath && existsSync(captionsPath)) caps = JSON.parse(readFileSync(captionsPath, 'utf8'));
  const payload = {
    targetCount, minSec, maxSec,
    // Prefer word-timestamped tokens; fall back to a plain transcript string.
    tokens: Array.isArray(caps)
      ? caps.map((c) => ({ t: (c.text || '').trim(), s: c.startMs, e: c.endMs }))
      : undefined,
    transcript: !Array.isArray(caps) ? String(transcript || '') : undefined,
  };
  const model = process.env.DIRECTOR_MODEL || process.env.LLM_MODEL || 'gpt-5.5';
  const url = `${/\/v1$/.test(base) ? base : base + '/v1'}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: HIGHLIGHTS_SYSTEM },
        { role: 'user', content: JSON.stringify(payload) },
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`highlights http ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const raw = (data.choices?.[0]?.message?.content || '').replace(/^```json\s*|\s*```$/g, '');
  const parsed = JSON.parse(raw);
  const highlights = Array.isArray(parsed.highlights) ? parsed.highlights : Array.isArray(parsed) ? parsed : [];
  return { ok: true, count: highlights.length, highlights };
}

// --- cut_clip --------------------------------------------------------------
async function tool_cut_clip({ video, startMs, endMs, out }) {
  if (!video || !existsSync(video)) throw new Error(`video not found: ${video}`);
  if (!(endMs > startMs)) throw new Error('endMs must be greater than startMs');
  const ss = (startMs / 1000).toFixed(3);
  const t = ((endMs - startMs) / 1000).toFixed(3);
  const outPath = out ? (isAbsolute(out) ? out : join(OUT, out)) : join(OUT, `${slugId(video)}-clip-${startMs}-${endMs}.mp4`);
  // Re-encode (not stream-copy) so the cut is frame-accurate and starts on a keyframe.
  const r = await ffmpeg([
    '-ss', ss, '-i', video, '-t', t,
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'veryfast', '-crf', '20',
    '-g', '48', '-keyint_min', '48', '-sc_threshold', '0',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
    outPath,
  ]);
  if (r.code !== 0) throw new Error(`cut_clip ffmpeg failed: ${r.stderr.slice(-400)}`);
  const meta = await probe(outPath);
  return { ok: true, path: outPath, durationMs: meta.durationMs, width: meta.width, height: meta.height };
}

// --- face_crop -------------------------------------------------------------
async function tool_face_crop({ video, out, mode = 'track', deadzone = 0.15, smooth = 0.3, jitter = 5 }) {
  if (!video || !existsSync(video)) throw new Error(`video not found: ${video}`);
  const outPath = out ? (isAbsolute(out) ? out : join(OUT, out)) : join(OUT, `${slugId(video)}-9x16.mp4`);
  const tmpVid = join(OUT, `${slugId(video)}-track-tmp.mp4`);
  let usedFallback = false;

  if (mode === 'track') {
    const r = await run('python3', [
      join(HERE, 'scripts', 'face_crop.py'),
      '--in', video, '--out', tmpVid,
      '--deadzone', String(deadzone), '--smooth', String(smooth), '--jitter', String(jitter),
    ]);
    let info = null;
    try {
      info = JSON.parse((r.stdout.trim().split('\n').pop() || '{}'));
    } catch {
      info = null;
    }
    if (r.code === 0 && info?.status === 'ok' && existsSync(tmpVid)) {
      // tmpVid is video-only 1080x1920 from OpenCV; mux original audio + normalize.
      const rr = await ffmpeg([
        '-i', tmpVid, '-i', video,
        '-map', '0:v:0', '-map', '1:a:0?',
        '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'veryfast', '-crf', '20',
        '-g', '48', '-keyint_min', '48', '-sc_threshold', '0',
        '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-shortest',
        outPath,
      ]);
      if (rr.code === 0 && existsSync(outPath)) {
        const meta = await probe(outPath);
        return { ok: true, path: outPath, mode: 'track', frames: info.frames, faceCoverage: info.coverage, width: meta.width, height: meta.height, durationMs: meta.durationMs };
      }
    }
    usedFallback = true; // no confident face track (or python/deps missing) → general fit
    log(`face_crop: track unavailable (${info?.reason || r.stderr.slice(-160) || 'unknown'}); using general blurred-fit`);
  }

  // GENERAL mode (and track fallback): 9:16 with blurred background fill — always works, no deps.
  const r = await ffmpeg([
    '-i', video,
    '-filter_complex',
    '[0:v]split=2[bg][fg];' +
      '[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=28[bg2];' +
      '[fg]scale=1080:1920:force_original_aspect_ratio=decrease[fg2];' +
      '[bg2][fg2]overlay=(W-w)/2:(H-h)/2,format=yuv420p[v]',
    '-map', '[v]', '-map', '0:a:0?',
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'veryfast', '-crf', '20',
    '-g', '48', '-keyint_min', '48', '-sc_threshold', '0',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
    outPath,
  ]);
  if (r.code !== 0) throw new Error(`face_crop general ffmpeg failed: ${r.stderr.slice(-400)}`);
  const meta = await probe(outPath);
  return { ok: true, path: outPath, mode: usedFallback ? 'general(fallback)' : 'general', width: meta.width, height: meta.height, durationMs: meta.durationMs };
}

// --- generate_image (gpt-image-2) -----------------------------------------
async function tool_generate_image({ prompt, out, size = '1024x1536', model = 'gpt-image-2' }) {
  const { base, key } = llmGateway();
  if (!base || !key) throw new Error('no OpenAI gateway (OPENAI_BASE_URL + OPENAI_API_KEY)');
  if (!prompt) throw new Error('prompt is required');
  const endpoint = `${/\/v1$/.test(base) ? base : base + '/v1'}/images/generations`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, prompt, n: 1, size }),
  });
  if (!res.ok) throw new Error(`images/generations ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const item = data?.data?.[0];
  const id = `gen-${createHash('sha1').update(prompt).digest('hex').slice(0, 10)}`;
  const outPath = out ? (isAbsolute(out) ? out : join(OUT, out)) : join(PUB, 'assets', `${id}.png`);
  if (item?.b64_json) {
    writeFileSync(outPath, Buffer.from(item.b64_json, 'base64'));
  } else if (item?.url) {
    const img = await fetch(item.url);
    writeFileSync(outPath, Buffer.from(await img.arrayBuffer()));
  } else {
    throw new Error('images/generations returned neither b64_json nor url');
  }
  return { ok: true, path: outPath, rel: outPath.startsWith(PUB) ? outPath.slice(PUB.length + 1) : undefined };
}

// --- AI video generation (anymodel via the CP video proxy) ------------------
// Real AI text-to-video (grok / veo / omni), billed by the platform per
// second×quality. Goes through CP (NOT the LLM gateway): the owner is charged
// tokens and the secret provider key stays server-side. Uses the pod's owner
// token (MARKET_TOKEN) against CP_SELF_URL.
function cpVideo() {
  const base = (process.env.CP_SELF_URL || process.env.MARKET_URL || '').replace(/\/+$/, '');
  const token = process.env.MARKET_TOKEN;
  if (!base || !token) throw new Error('AI video unavailable (CP_SELF_URL + MARKET_TOKEN not set)');
  return { base, token };
}

async function tool_generate_ai_video({ model, prompt, duration = 8, resolution = '720p', aspect_ratio }) {
  const { base, token } = cpVideo();
  if (!prompt) throw new Error('prompt is required');
  if (!model) throw new Error('model is required (see list_ai_video_models)');
  const res = await fetch(`${base}/v1/me/video/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ model, prompt, duration, resolution, aspectRatio: aspect_ratio }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`video/generate ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  // { ok, requestId, model, resolution, duration, tokensCharged, balanceTokens }
  return data;
}

async function tool_ai_video_status({ requestId, download = true, out }) {
  const { base, token } = cpVideo();
  if (!requestId) throw new Error('requestId is required');
  const res = await fetch(`${base}/v1/me/video/${encodeURIComponent(requestId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`video/status ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  const job = data?.job ?? data;
  // Hunt for a finished video URL across common provider shapes.
  const url =
    job?.url || job?.video_url || job?.output_url || job?.result?.url ||
    job?.output?.[0]?.url || job?.data?.[0]?.url || job?.assets?.[0]?.url || null;
  if (url && download) {
    const id = `ai-${createHash('sha1').update(requestId).digest('hex').slice(0, 10)}`;
    const outPath = out ? (isAbsolute(out) ? out : join(OUT, out)) : join(OUT, `${id}.mp4`);
    const bin = await fetch(url);
    if (bin.ok) {
      writeFileSync(outPath, Buffer.from(await bin.arrayBuffer()));
      return { ok: true, status: 'ready', path: outPath, url, job };
    }
  }
  return { ok: true, status: url ? 'ready' : 'pending', url, job };
}

async function tool_list_ai_video_models() {
  const { base, token } = cpVideo();
  const res = await fetch(`${base}/v1/me/video/models`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`video/models ${res.status}`);
  return data; // { ok, models:[{id, resolutions, ratesPerSecond, aspectFormat, durations}] }
}

// --- TTS (anymodel edge-tts via the CP proxy) -------------------------------
// Text-to-speech, billed by the platform per character. Synchronous: CP returns
// the mp3 (base64); we save it and hand back the path for use as reel narration.
async function tool_speak({ text, voice = 'edge-tts/ru-RU-SvetlanaNeural', out }) {
  const { base, token } = cpVideo();
  if (!text) throw new Error('text is required');
  const model = /^edge-tts\//.test(voice) ? voice : `edge-tts/${voice}`;
  const res = await fetch(`${base}/v1/me/tts/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
  const { base, token } = cpVideo();
  const res = await fetch(`${base}/v1/me/tts/voices`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`tts/voices ${res.status}`);
  return data;
}

// --- search_stock (Pexels) -------------------------------------------------
async function tool_search_stock({ query, orientation = 'portrait', out }) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error('PEXELS_API_KEY is not set');
  if (!query) throw new Error('query is required');
  const url = new URL('https://api.pexels.com/v1/search');
  url.searchParams.set('query', query);
  url.searchParams.set('orientation', orientation);
  url.searchParams.set('per_page', '15');
  url.searchParams.set('size', 'large');
  const res = await fetch(url, { headers: { Authorization: key } });
  if (!res.ok) throw new Error(`Pexels ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const photos = Array.isArray(data.photos) ? data.photos : [];
  if (!photos.length) throw new Error(`Pexels returned 0 photos for "${query}"`);
  const pick = photos[createHash('sha1').update(query).digest()[0] % photos.length];
  const dl = pick.src?.large2x || pick.src?.original || pick.src?.large;
  const id = `stock-${createHash('sha1').update(query).digest('hex').slice(0, 10)}`;
  const outPath = out ? (isAbsolute(out) ? out : join(OUT, out)) : join(PUB, 'assets', `${id}.jpg`);
  const img = await fetch(dl);
  writeFileSync(outPath, Buffer.from(await img.arrayBuffer()));
  return { ok: true, path: outPath, rel: outPath.startsWith(PUB) ? outPath.slice(PUB.length + 1) : undefined, credit: pick.photographer, creditUrl: pick.url };
}

// --- render_reel (Remotion BrandedReel) ------------------------------------
async function tool_render_reel({ storyboard, footage, audio, fetchAssets = true }) {
  let sb = storyboard;
  if (typeof sb === 'string') {
    // Allow a path to a storyboard JSON or a raw JSON string.
    sb = existsSync(sb) ? JSON.parse(readFileSync(sb, 'utf8')) : JSON.parse(sb);
  }
  if (!sb || typeof sb !== 'object') throw new Error('storyboard must be an object (or JSON string / path)');
  if (!Array.isArray(sb.scenes) || !sb.scenes.length) throw new Error('storyboard.scenes must be a non-empty array');

  const { id, rel } = await stageFootage(footage, audio);
  sb.src = rel;
  if (!sb.theme) sb.theme = 'razbor';
  if (!sb.topic) sb.topic = '';
  if (!Array.isArray(sb.chapters)) sb.chapters = [];
  // Flatten any {type, data:{...}} scene wrappers so the compositor gets flat props.
  sb.scenes = sb.scenes.map((s) => {
    if (s && typeof s.data === 'object' && s.data && !Array.isArray(s.data)) {
      const { data, ...rest } = s;
      return { ...rest, ...data };
    }
    return s;
  });

  const storyFile = join(PUB, `story-${id}.json`);
  writeFileSync(storyFile, JSON.stringify(sb, null, 2));

  // Fetch/generate images for ImageInsert scenes (proven script; never blocks render).
  if (fetchAssets && sb.scenes.some((s) => s?.type === 'ImageInsert')) {
    await run('node', ['scripts/fetch-assets.mjs', `public/story-${id}.json`]);
  }

  const rawOut = join(OUT, `${id}.mp4`);
  const r = await run('npx', [
    'remotion', 'render', 'BrandedReel', rawOut,
    `--props=public/story-${id}.json`,
    `--concurrency=${process.env.RENDER_CONCURRENCY || '2'}`,
  ]);
  if (r.code !== 0 || !existsSync(rawOut)) {
    throw new Error(`remotion render failed: ${(r.stderr || r.stdout).slice(-500)}`);
  }
  // Remotion output is already H.264/yuv420p — just move the moov atom (fast).
  const finalOut = join(OUT, `${id}-final.mp4`);
  await normalize(rawOut, finalOut, { remux: true });
  const meta = await probe(finalOut);
  return { ok: true, path: finalOut, storyboardPath: storyFile, width: meta.width, height: meta.height, durationMs: meta.durationMs };
}

// --- send_video (Telegram Bot API sendVideo) -------------------------------
async function tool_send_video({ chatId, path: videoPath, caption = '', threadId }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  if (!chatId) throw new Error('chatId is required');
  if (!videoPath || !existsSync(videoPath)) throw new Error(`video not found: ${videoPath}`);

  const size = statSync(videoPath).size;
  const meta = await probe(videoPath);

  // Poster frame at ~1s so Telegram shows a proper thumbnail (not a black box).
  const thumbPath = join(OUT, `${slugId(videoPath)}-thumb.jpg`);
  await ffmpeg(['-ss', '1', '-i', videoPath, '-frames:v', '1', '-vf', 'scale=320:-2', thumbPath]).catch(() => {});

  const form = new FormData();
  form.set('chat_id', String(chatId));
  if (threadId != null && threadId !== '') form.set('message_thread_id', String(threadId));
  form.set('caption', caption);
  form.set('supports_streaming', 'true');
  if (meta.width) form.set('width', String(meta.width));
  if (meta.height) form.set('height', String(meta.height));
  if (meta.durationMs) form.set('duration', String(Math.round(meta.durationMs / 1000)));
  form.set('video', new Blob([readFileSync(videoPath)], { type: 'video/mp4' }), basename(videoPath));
  if (existsSync(thumbPath)) form.set('thumbnail', new Blob([readFileSync(thumbPath)], { type: 'image/jpeg' }), 'thumb.jpg');

  if (size > 50 * 1024 * 1024) {
    log(`send_video: file is ${(size / 1e6).toFixed(1)}MB (>50MB cloud Bot API limit) — Telegram may reject`);
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendVideo`, { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(`sendVideo failed: http ${res.status} ${JSON.stringify(data).slice(0, 300)}`);
  }
  return { ok: true, messageId: data.result?.message_id, chatId, width: meta.width, height: meta.height, bytes: size };
}

// --- job_status ------------------------------------------------------------
function tool_job_status({ jobId }) {
  const j = readJob(jobId);
  if (!j) return { ok: false, error: `no such job: ${jobId}` };
  return { ok: true, ...j };
}

// ===========================================================================
// MCP wiring
// ===========================================================================
const TOOLS = [
  {
    name: 'transcribe',
    description:
      'Transcribe a video to word-timestamped captions (whisper medium/RU, the proven sub.mjs). Returns {transcript, captions[], captionsPath, durationMs}. captions are the timing source for your storyboard and the input to analyze_highlights. Slow on first run (downloads the model) — pass async:true for long files.',
    inputSchema: {
      type: 'object',
      properties: {
        video: { type: 'string', description: 'Absolute path to the input video the user sent.' },
        audio: { type: 'string', description: 'Optional separate audio/voiceover to mux over the video.' },
        async: { type: 'boolean', description: 'Run in background and return a jobId to poll with job_status.' },
      },
      required: ['video'],
    },
  },
  {
    name: 'analyze_highlights',
    description:
      'Cut a LONG video by MEANING: gpt-5.5 reads the word-timestamped transcript and returns the most viral self-contained moments [{startMs,endMs,title,hook,why}]. Pass captions (from transcribe) or captionsPath. Tune targetCount/minSec/maxSec. Then cut_clip each moment.',
    inputSchema: {
      type: 'object',
      properties: {
        captions: { type: 'array', description: 'Word-timestamped tokens from transcribe (preferred).' },
        captionsPath: { type: 'string', description: 'Path to a captions JSON instead of inline captions.' },
        transcript: { type: 'string', description: 'Plain transcript text if you have no timestamps.' },
        targetCount: { type: 'integer', description: 'How many moments to return (default 5).' },
        minSec: { type: 'number', description: 'Minimum clip length in seconds (default 15).' },
        maxSec: { type: 'number', description: 'Maximum clip length in seconds (default 60).' },
      },
    },
  },
  {
    name: 'cut_clip',
    description: 'Extract one moment [startMs,endMs] from a video as a frame-accurate, keyframe-aligned, faststart mp4 (ffmpeg). Use after analyze_highlights.',
    inputSchema: {
      type: 'object',
      properties: {
        video: { type: 'string', description: 'Absolute path to the source video.' },
        startMs: { type: 'integer', description: 'Clip start in milliseconds.' },
        endMs: { type: 'integer', description: 'Clip end in milliseconds (> startMs).' },
        out: { type: 'string', description: 'Optional output path/name (defaults into the out/ dir).' },
      },
      required: ['video', 'startMs', 'endMs'],
    },
  },
  {
    name: 'face_crop',
    description:
      'Reframe a landscape/horizontal video to 9:16 (1080x1920). mode:"track" follows the speaker with MediaPipe using a deadzone + damped smoothing + jitter suppression (anti-jitter virtual camera); mode:"general" (or the automatic fallback when no face is confidently tracked) fits the frame over a blurred background. Output is Telegram-ready. Pass async:true for long clips.',
    inputSchema: {
      type: 'object',
      properties: {
        video: { type: 'string', description: 'Absolute path to the video to reframe.' },
        out: { type: 'string', description: 'Optional output path/name.' },
        mode: { type: 'string', enum: ['track', 'general'], description: 'track = speaker-following crop; general = blurred-fit. Default track.' },
        deadzone: { type: 'number', description: 'Fraction of width the subject may drift before the camera moves (default 0.15).' },
        smooth: { type: 'number', description: 'Camera catch-up factor 0..1, lower = smoother (default 0.3).' },
        jitter: { type: 'number', description: 'Ignore subject moves smaller than this many px (default 5).' },
        async: { type: 'boolean', description: 'Run in background and return a jobId.' },
      },
      required: ['video'],
    },
  },
  {
    name: 'generate_image',
    description: 'Generate an image with gpt-image-2 via the pod gateway (branded/abstract inserts, thumbnails, backgrounds). Returns {path, rel}. For a storyboard ImageInsert prefer letting render_reel fetch it; use this for standalone images.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'What to generate.' },
        size: { type: 'string', description: 'e.g. 1024x1536 (portrait), 1536x1024 (landscape), 1024x1024.' },
        out: { type: 'string', description: 'Optional output path/name.' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'list_ai_video_models',
    description: 'List available AI text-to-video models (grok/veo/omni) with resolutions + per-second token cost. Call before generate_ai_video to pick a model the owner can afford.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'generate_ai_video',
    description: 'Generate a REAL AI text-to-video clip (grok/veo/omni via the platform). Charges the owner tokens = duration×quality (checked first; 402 if low balance). Async: returns {requestId, tokensCharged, balanceTokens}; then poll ai_video_status. Use this for genuine AI-generated footage; use render_reel for the Remotion subtitle/edit render.',
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
    description: 'Poll an AI video job by requestId. When ready, downloads the mp4 and returns {status:"ready", path}. While rendering returns {status:"pending"}.',
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
    description: 'Text-to-speech (AI voiceover) via the platform. Billed per character to the owner. Returns {path} to an mp3 you can use as narration/voiceover in render_reel. Voices: edge-tts/<voice>, e.g. edge-tts/ru-RU-SvetlanaNeural, edge-tts/ru-RU-DmitryNeural, edge-tts/en-US-AriaNeural.',
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
  {
    name: 'search_stock',
    description: 'Find a real-world stock photo on Pexels. Returns {path, rel, credit}. Requires PEXELS_API_KEY.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to search for.' },
        orientation: { type: 'string', enum: ['portrait', 'landscape', 'square'], description: 'Default portrait.' },
        out: { type: 'string', description: 'Optional output path/name.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'render_reel',
    description:
      'Render a branded vertical reel with the PROVEN Remotion BrandedReel composition. YOU author the storyboard {theme:"razbor"|"dosie"|"krasny", topic, chapters:[], scenes:[]} (see SKILL.md for the scene catalog); each scene is FLAT {type,fromMs,toMs,...fields}. This stages the footage, fetches any ImageInsert assets, renders 1080x1920, and returns a Telegram-ready {path}. Pass async:true — rendering takes ~60s.',
    inputSchema: {
      type: 'object',
      properties: {
        storyboard: { type: 'object', description: 'The storyboard you authored: {theme, topic, chapters[], scenes[]}. (May also be a JSON string or a path.)' },
        footage: { type: 'string', description: 'Absolute path to the base footage the reel plays under the captions.' },
        audio: { type: 'string', description: 'Optional separate audio to mux.' },
        fetchAssets: { type: 'boolean', description: 'Fetch/generate ImageInsert images before render (default true).' },
        async: { type: 'boolean', description: 'Run in background and return a jobId.' },
      },
      required: ['storyboard', 'footage'],
    },
  },
  {
    name: 'send_video',
    description:
      'Deliver a finished mp4 to the user in Telegram as a real 9:16 streaming VIDEO (not a square, not a document): calls Bot API sendVideo with width/height/duration/supports_streaming/thumbnail. Pass threadId when the agent lives in a Telegram topic. This is how results reach the user.',
    inputSchema: {
      type: 'object',
      properties: {
        chatId: { type: 'string', description: 'Telegram chat id to send to.' },
        path: { type: 'string', description: 'Absolute path to the mp4 (from render_reel / cut_clip / face_crop).' },
        caption: { type: 'string', description: 'Short caption.' },
        threadId: { type: 'string', description: 'message_thread_id when inside a Telegram topic.' },
      },
      required: ['chatId', 'path'],
    },
  },
  {
    name: 'job_status',
    description: 'Poll a background job started with async:true. Returns {status:"running"|"done"|"error", result?, error?}.',
    inputSchema: { type: 'object', properties: { jobId: { type: 'string' } }, required: ['jobId'] },
  },
];

const HANDLERS = {
  transcribe: (a) => maybeAsync('transcribe', a.async, () => tool_transcribe(a)),
  analyze_highlights: (a) => tool_analyze_highlights(a),
  cut_clip: (a) => tool_cut_clip(a),
  face_crop: (a) => maybeAsync('face_crop', a.async, () => tool_face_crop(a)),
  generate_image: (a) => tool_generate_image(a),
  list_ai_video_models: () => tool_list_ai_video_models(),
  generate_ai_video: (a) => tool_generate_ai_video(a),
  ai_video_status: (a) => tool_ai_video_status(a),
  speak: (a) => tool_speak(a),
  list_voices: () => tool_list_voices(),
  search_stock: (a) => tool_search_stock(a),
  render_reel: (a) => maybeAsync('render_reel', a.async, () => tool_render_reel(a)),
  send_video: (a) => tool_send_video(a),
  job_status: (a) => tool_job_status(a),
};

const server = new Server(
  { name: 'video-studio', version: '1.0.0' },
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
log(`ready. studio=${STUDIO}`);
