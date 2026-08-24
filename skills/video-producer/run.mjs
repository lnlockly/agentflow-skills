#!/usr/bin/env node
/**
 * run.mjs — the video-producer orchestrator. ONE command that turns a blogger's
 * footage into a branded "разбор/досье" Shorts reel.
 *
 *   node run.mjs <input-video> ["тема ролика"] [--theme dosie|razbor|krasny]
 *
 * Pipeline (all inside the agent pod, everything self-contained):
 *   1. copy footage → public/<id>.mp4 (mux a separate audio arg if given)
 *   2. whisper (medium/ru, token-level) → public/<id>.json   (sub.mjs)
 *   3. DIRECTOR: gpt-5.5 reads the transcript → storyboard JSON  (this file)
 *   4. assets: search/generate images (gpt-image-2)          (fetch-assets.mjs)
 *   5. render: Remotion BrandedReel → out/<id>.mp4           (render.mjs / remotion)
 *   6. print OUT=<abs path> — the agent sends that file to the user.
 *
 * Reliability first: if the director LLM call fails or returns junk, we fall
 * back to a deterministic template storyboard so a reel is ALWAYS produced.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';

const HERE = resolve(new URL('.', import.meta.url).pathname);
const PUB = join(HERE, 'public');
const OUT = join(HERE, 'out');
mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const flags = {};
const pos = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) flags[args[i].slice(2)] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
  else pos.push(args[i]);
}
const input = pos[0];
const topicArg = pos[1] || '';
if (!input || !existsSync(input)) {
  console.error('usage: node run.mjs <input-video> ["тема"] [--theme dosie|razbor|krasny] [--audio a.m4a]');
  process.exit(2);
}

const id = (basename(input, extname(input)) || 'reel').replace(/[^a-z0-9_-]/gi, '_').slice(0, 40) || 'reel';
const videoPub = join(PUB, `${id}.mp4`);
const log = (...m) => console.log('[run]', ...m);

/* ---- 1. footage into public/ (mux external audio if provided) ----------- */
function sh(cmd, argv) {
  return execFileSync(cmd, argv, { cwd: HERE, stdio: ['ignore', 'pipe', 'inherit'] }).toString();
}
log('1/5 stage footage');
if (flags.audio && existsSync(flags.audio)) {
  sh('npx', ['remotion', 'ffmpeg', '-y', '-i', input, '-i', flags.audio, '-c:v', 'copy', '-c:a', 'aac', '-shortest', videoPub]);
} else if (resolve(input) !== videoPub) {
  sh('cp', ['-f', input, videoPub]);
} else {
  log('input already staged in public/');
}

/* ---- 2. transcribe (whisper medium/ru) ---------------------------------- */
log('2/5 transcribe (whisper medium/ru)');
sh('node', ['sub.mjs', `public/${id}.mp4`]);
const capFile = join(PUB, `${id}.json`);
const captions = existsSync(capFile) ? JSON.parse(readFileSync(capFile, 'utf8')) : [];
const transcript = captions.map((c) => (c.text || '').trim()).join(' ').replace(/\s+/g, ' ').trim();
log(`transcript (${captions.length} tokens): ${transcript.slice(0, 120)}…`);

/* ---- 3. DIRECTOR: gpt-5.5 → storyboard ---------------------------------- */
const THEMES = ['razbor', 'dosie', 'krasny'];
const theme = THEMES.includes(flags.theme) ? flags.theme : '';

const DIRECTOR_SYSTEM = readFileSync(join(HERE, 'director.prompt.md'), 'utf8');

async function director() {
  let base = (process.env.OPENAI_BASE_URL || process.env.LLM_BASE_URL || '').replace(/\/$/, '');
  if (base && !/\/v1$/.test(base)) base += '/v1';
  const key = process.env.OPENAI_API_KEY || process.env.LLM_KEY;
  if (!base || !key) throw new Error('no LLM gateway env (OPENAI_BASE_URL/LLM_BASE_URL + key)');
  const model = process.env.DIRECTOR_MODEL || process.env.LLM_MODEL || 'gpt-5.5';
  const user = JSON.stringify({ topic: topicArg || undefined, theme: theme || undefined, durationMs: (captions.at(-1)?.endMs) || 15000, transcript });
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: DIRECTOR_SYSTEM }, { role: 'user', content: user }],
      temperature: 0.6,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`director http ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || '';
  const json = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ''));
  if (!Array.isArray(json.scenes) || !json.scenes.length) throw new Error('director returned no scenes');
  return json;
}

/** Deterministic fallback so a reel is ALWAYS produced. */
function fallbackStory() {
  const end = (captions.at(-1)?.endMs) || 15000;
  const q = (transcript.slice(0, 90) || 'реальная история') + '…';
  return {
    theme: theme || 'dosie',
    topic: topicArg || 'РАЗБОР',
    chapters: ['ЗАВЯЗКА', 'ПОВОРОТ', 'ВЫВОД'],
    scenes: [
      { type: 'VoiceBubble', fromMs: 0, toMs: Math.min(4000, end * 0.3), sender: 'ОН', quote: q, durationLabel: '0:04', silhouette: true },
      { type: 'StoryStepper', fromMs: Math.min(4000, end * 0.3), toMs: Math.min(end * 0.7, end - 2500), title: 'ХРОНОЛОГИЯ', steps: [{ label: 'НАЧАЛО' }, { label: 'СОБЫТИЕ' }, { label: 'ПОВОРОТ' }, { label: 'ФИНАЛ' }], activeIndex: 2 },
      { type: 'PunchWord', fromMs: Math.min(end * 0.7, end - 2500), toMs: end, word: 'ВОТ ТАК', filled: true, shatter: true },
    ],
  };
}

log('3/5 director (gpt-5.5)');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let story;
for (let attempt = 1; attempt <= 3 && !story; attempt++) {
  try {
    story = await director();
    log(`director OK (try ${attempt}): theme=${story.theme} scenes=${story.scenes.length}`);
  } catch (e) {
    log(`director try ${attempt} failed: ${e.message}`);
    if (attempt < 3) await sleep(2000 * attempt);
  }
}
if (!story) {
  log('director exhausted retries → deterministic fallback');
  story = fallbackStory();
}
story.src = `${id}.mp4`;
if (theme) story.theme = theme;
// Normalize: some LLMs nest scene fields under `data` — flatten it so the
// compositor (which spreads the scene flat) always gets top-level props.
story.scenes = (story.scenes || []).map((s) => {
  if (s && typeof s.data === 'object' && s.data && !Array.isArray(s.data)) {
    const { data, ...rest } = s;
    return { ...rest, ...data };
  }
  return s;
});
const storyFile = join(PUB, `story-${id}.json`);
writeFileSync(storyFile, JSON.stringify(story, null, 2));

/* ---- 4. assets (search/generate images) --------------------------------- */
log('4/5 assets (Pexels / gpt-image-2)');
try {
  sh('node', ['scripts/fetch-assets.mjs', `public/story-${id}.json`]);
} catch (e) {
  log(`assets step non-fatal: ${e.message}`);
}

/* ---- 5. render ---------------------------------------------------------- */
log('5/5 render (Remotion BrandedReel)');
const outMp4 = join(OUT, `${id}.mp4`);
sh('npx', ['remotion', 'render', 'BrandedReel', outMp4, `--props=public/story-${id}.json`, `--concurrency=${process.env.RENDER_CONCURRENCY || '2'}`]);

console.log(`OUT=${outMp4}`);
