#!/usr/bin/env node
/**
 * scripts/fetch-assets.mjs
 * -----------------------------------------------------------------------------
 * Asset pipeline for the BrandedReel director. Runs INSIDE the agent pod BEFORE
 * `remotion render`. Reads a storyboard JSON, and for every ImageInsert scene
 * (type === 'ImageInsert') it either:
 *   (a) SEARCHES Pexels for a matching real-world stock photo, or
 *   (b) GENERATES one via the OpenAI-compatible images endpoint (gpt-image-2).
 *
 * The chosen image is downloaded to  public/assets/<id>.jpg  and the scene's
 * `src` is rewritten to the local, staticFile-relative path (`assets/<id>.jpg`)
 * so the ImageInsert component can render it deterministically at render time.
 *
 * DECISION RULE (search vs generate)
 * ----------------------------------
 * Honour an explicit `source: 'search' | 'generate'` on the scene first.
 * Otherwise apply the heuristic:
 *   - GENERATE  when the image is ABSTRACT or BRANDED (a `prompt` field, or
 *     `abstract: true` / `branded: true`).
 *   - SEARCH    when the image is a REAL-WORLD thing stock covers well
 *     (signalled by a `query` field).
 * When both a prompt and a query exist we prefer GENERATE (brand control wins);
 * when neither exists the scene is left srcless so ImageInsert skips it.
 *
 * SECRETS are read from the environment ONLY and never logged:
 *   PEXELS_API_KEY                        - Pexels stock search
 *   OPENAI_BASE_URL (or OPENAI_API_BASE)  - LiteLLM gateway base URL
 *   OPENAI_API_KEY                        - LiteLLM gateway key
 *
 * USAGE
 *   node scripts/fetch-assets.mjs <storyboard.json> [--out public/assets] \
 *        [--public public] [--dry-run] [--force]
 *
 * The storyboard file is rewritten in place (a .bak copy is kept once).
 * Exit code is 0 even when individual images fail — a missing image only means
 * that one scene is skipped, never that the whole render is blocked.
 * -----------------------------------------------------------------------------
 */

import { readFile, writeFile, mkdir, access, copyFile } from 'node:fs/promises';
import { constants as FS } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';

// The storyboard `type` literal for image inserts (PascalCase, matches the
// SceneSchema discriminant + SCENE_REGISTRY key in src/BrandedReel).
const IMAGE_SCENE_TYPE = 'ImageInsert';

// ----------------------------------------------------------------------------
// Small utilities
// ----------------------------------------------------------------------------

const log = (...a) => console.log('[fetch-assets]', ...a);
const warn = (...a) => console.warn('[fetch-assets] WARN', ...a);

/** Redact anything that looks like a secret before it can reach a log line. */
function redact(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1***').replace(/(sk-[A-Za-z0-9]{6})[A-Za-z0-9]+/g, '$1***');
}

async function exists(p) {
  try {
    await access(p, FS.F_OK);
    return true;
  } catch {
    return false;
  }
}

/** Parse a tiny flag set without pulling a dependency. */
function parseArgs(argv) {
  const args = { _: [], out: null, public: 'public', dryRun: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force') args.force = true;
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--public') args.public = argv[++i];
    else if (a.startsWith('--')) warn(`unknown flag ${a}`);
    else args._.push(a);
  }
  return args;
}

/** Deterministic, filesystem-safe id for a scene that lacks one. */
function sceneId(scene, index) {
  if (scene.id && /^[a-z0-9_-]+$/i.test(scene.id)) return scene.id;
  const seed = JSON.stringify([scene.type, scene.query, scene.prompt, scene.caption, index]);
  return `img-${index}-${createHash('sha1').update(seed).digest('hex').slice(0, 8)}`;
}

// ----------------------------------------------------------------------------
// Decision rule
// ----------------------------------------------------------------------------

function decideSource(scene) {
  if (scene.source === 'search' || scene.source === 'generate') return scene.source;
  const hasPrompt = typeof scene.prompt === 'string' && scene.prompt.trim().length > 0;
  const hasQuery = typeof scene.query === 'string' && scene.query.trim().length > 0;
  if (scene.branded || scene.abstract) return 'generate';
  if (hasPrompt && hasQuery) return 'generate'; // brand control wins the tie
  if (hasPrompt) return 'generate';
  if (hasQuery) return 'search';
  return null; // nothing to fetch
}

/** Map a scene orientation hint to a Pexels orientation + a gpt-image size. */
function geometryFor(scene) {
  // Top band of a 1080x1920 reel is landscape-ish (divider at y=864).
  const o = (scene.orientation || 'landscape').toLowerCase();
  if (o === 'portrait') return { pexels: 'portrait', size: '1024x1536' };
  if (o === 'square') return { pexels: 'square', size: '1024x1024' };
  return { pexels: 'landscape', size: '1536x1024' };
}

// ----------------------------------------------------------------------------
// Network: download helper
// ----------------------------------------------------------------------------

async function downloadTo(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1024) throw new Error(`download too small (${buf.length} bytes)`);
  await writeFile(destPath, buf);
  return buf.length;
}

// ----------------------------------------------------------------------------
// Provider (a): Pexels stock search
// ----------------------------------------------------------------------------

async function fetchFromPexels(scene, destPath) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error('PEXELS_API_KEY is not set');
  const query = (scene.query || scene.caption || '').trim();
  if (!query) throw new Error('no query for Pexels search');

  const { pexels } = geometryFor(scene);
  const url = new URL('https://api.pexels.com/v1/search');
  url.searchParams.set('query', query);
  url.searchParams.set('orientation', pexels);
  url.searchParams.set('per_page', '15');
  url.searchParams.set('size', 'large');

  const res = await fetch(url, { headers: { Authorization: key } });
  if (!res.ok) throw new Error(`Pexels ${res.status} ${res.statusText}`);
  const data = await res.json();
  const photos = Array.isArray(data.photos) ? data.photos : [];
  if (photos.length === 0) throw new Error(`Pexels returned 0 photos for "${query}"`);

  // Deterministic pick: hash the query so re-runs are stable, but stay in range.
  const pick = photos[createHash('sha1').update(query).digest()[0] % photos.length];
  const dl = pick.src?.large2x || pick.src?.original || pick.src?.large;
  if (!dl) throw new Error('Pexels photo had no usable src');

  const bytes = await downloadTo(dl, destPath);
  return { bytes, credit: pick.photographer, creditUrl: pick.url };
}

// ----------------------------------------------------------------------------
// Provider (b): OpenAI-compatible image generation (gpt-image-2)
// ----------------------------------------------------------------------------

async function fetchFromGenerate(scene, destPath) {
  const key = process.env.OPENAI_API_KEY;
  const base = process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE;
  if (!key) throw new Error('OPENAI_API_KEY is not set');
  if (!base) throw new Error('OPENAI_BASE_URL is not set');
  const prompt = (scene.prompt || scene.caption || scene.query || '').trim();
  if (!prompt) throw new Error('no prompt for image generation');

  const { size } = geometryFor(scene);
  const endpoint = `${base.replace(/\/+$/, '')}/images/generations`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: scene.model || 'gpt-image-2',
      prompt,
      n: 1,
      size,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`images/generations ${res.status} ${res.statusText} ${redact(body).slice(0, 300)}`);
  }
  const data = await res.json();
  const item = data?.data?.[0];
  if (!item) throw new Error('images/generations returned no data');

  let bytes;
  if (item.b64_json) {
    const buf = Buffer.from(item.b64_json, 'base64');
    if (buf.length < 1024) throw new Error('generated image too small');
    await writeFile(destPath, buf);
    bytes = buf.length;
  } else if (item.url) {
    bytes = await downloadTo(item.url, destPath);
  } else {
    throw new Error('images/generations returned neither b64_json nor url');
  }
  return { bytes };
}

// ----------------------------------------------------------------------------
// Per-scene processing
// ----------------------------------------------------------------------------

async function processScene(scene, index, ctx) {
  const id = sceneId(scene, index);
  const rel = path.posix.join(path.basename(ctx.outDir), `${id}.jpg`); // e.g. assets/<id>.jpg
  const destPath = path.join(ctx.outDir, `${id}.jpg`);

  // Idempotency: already a local asset that exists on disk -> keep it.
  const alreadyLocal =
    typeof scene.src === 'string' && !/^https?:/i.test(scene.src) && (await exists(path.join(ctx.publicDir, scene.src)));
  if (alreadyLocal && !ctx.force) {
    log(`scene[${index}] ${id}: local asset present, skipping (${scene.src})`);
    return { id, status: 'kept', src: scene.src };
  }

  const source = decideSource(scene);
  if (!source) {
    warn(`scene[${index}] ${id}: no source/query/prompt -> cannot fetch, leaving srcless (scene will skip)`);
    return { id, status: 'skipped' };
  }

  if (ctx.dryRun) {
    log(`scene[${index}] ${id}: [dry-run] would ${source} -> ${rel}`);
    return { id, status: 'dry-run', source };
  }

  try {
    const result =
      source === 'search' ? await fetchFromPexels(scene, destPath) : await fetchFromGenerate(scene, destPath);
    // Rewrite the scene to point at the local file (staticFile-relative).
    scene.src = rel;
    if (result.credit) scene.credit = result.credit;
    log(`scene[${index}] ${id}: ${source} OK -> ${rel} (${result.bytes} bytes)`);
    return { id, status: 'ok', source, src: rel };
  } catch (err) {
    warn(`scene[${index}] ${id}: ${source} FAILED -> ${redact(String(err.message || err))}. Scene will skip.`);
    // Do NOT set src on failure: ImageInsert renders null and the beat still
    // shows the HUD band, so a bad fetch never breaks the render.
    return { id, status: 'error', source, error: String(err.message || err) };
  }
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const storyboardPath = args._[0];
  if (!storyboardPath) {
    console.error('usage: node scripts/fetch-assets.mjs <storyboard.json> [--out public/assets] [--public public] [--dry-run] [--force]');
    process.exit(2);
  }
  if (!(await exists(storyboardPath))) {
    console.error(`[fetch-assets] storyboard not found: ${storyboardPath}`);
    process.exit(2);
  }

  const publicDir = path.resolve(args.public);
  const outDir = args.out ? path.resolve(args.out) : path.join(publicDir, 'assets');
  await mkdir(outDir, { recursive: true });

  let storyboard;
  try {
    storyboard = JSON.parse(await readFile(storyboardPath, 'utf8'));
  } catch (err) {
    console.error(`[fetch-assets] invalid JSON in storyboard: ${err.message}`);
    process.exit(2);
  }
  if (!Array.isArray(storyboard.scenes)) {
    console.error('[fetch-assets] storyboard.scenes is missing or not an array');
    process.exit(2);
  }

  const ctx = { outDir, publicDir, dryRun: args.dryRun, force: args.force };
  const imageScenes = storyboard.scenes
    .map((scene, index) => ({ scene, index }))
    .filter(({ scene }) => scene && scene.type === IMAGE_SCENE_TYPE);

  if (imageScenes.length === 0) {
    log('no ImageInsert scenes in storyboard, nothing to do');
    return;
  }
  log(`found ${imageScenes.length} ImageInsert scene(s); out=${outDir}`);

  const results = [];
  for (const { scene, index } of imageScenes) {
    // Sequential on purpose: gentle on rate limits and gpt-image-2 token spend.
    // eslint-disable-next-line no-await-in-loop
    results.push(await processScene(scene, index, ctx));
  }

  const failed = results.filter((r) => r.status === 'error').length;
  const ok = results.filter((r) => r.status === 'ok').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;

  if (!args.dryRun) {
    // Keep a single .bak so re-runs never clobber the pristine director output.
    const bak = `${storyboardPath}.bak`;
    if (!(await exists(bak))) await copyFile(storyboardPath, bak);
    await writeFile(storyboardPath, JSON.stringify(storyboard, null, 2));
    log(`storyboard rewritten: ${storyboardPath} (backup: ${bak})`);
  }

  log(`done: ${ok} fetched, ${skipped} srcless-skipped, ${failed} failed (render is not blocked)`);
}

main().catch((err) => {
  console.error('[fetch-assets] fatal:', redact(String(err?.stack || err)));
  process.exit(1);
});
