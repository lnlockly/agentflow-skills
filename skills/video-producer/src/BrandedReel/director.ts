/**
 * src/BrandedReel/director.ts — the DIRECTOR BRAIN.
 *
 * Turns a whisper transcript (Caption[]) into a validated BrandedReel storyboard
 * the compositor can render. This module is Node-side and pulls in NO React /
 * Remotion runtime — only the pure zod schema from ./storyboard.
 *
 * Exports:
 *   - DIRECTOR_SYSTEM_PROMPT  — the rigorous RU system prompt (registered scenes only)
 *   - buildDirectorInput()    — pack captions + prefs into the LLM user message
 *   - parseDirectorOutput()   — validate the LLM answer (string|object) -> BrandedReel
 *   - EXAMPLE_STORYBOARD      — the worked spetsnaz example (mirrors story-spetsnaz.json)
 */

import type { Caption } from '@remotion/captions';
import {
  brandedReelStrictSchema,
  safeParseBrandedReel,
  type BrandedReel,
} from './storyboard';

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

export interface BrandPrefs {
  /** Footage filename the reel is cut over; the director MUST echo it back. */
  src?: string;
  themeHint?: 'razbor' | 'dosie' | 'krasny';
  topicHint?: string;
  tone?: string;
  language?: string;
  bannedWords?: string[];
  maxScenes?: number;
  fps?: number;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

export const DIRECTOR_SYSTEM_PROMPT = `Ты — режиссёр вертикальных роликов «РАЗБОР / ДОСЬЕ» (1080×1920, 30fps).
Ты получаешь транскрипт речи (слова с таймингами) и возвращаешь СТРОГИЙ JSON-сториборд.

МАКЕТ КАДРА:
— ВЕРХ (~45%): постоянный HUD (topic + % + степпер глав) и ОДНА motion-сцена на бит.
— Красный разделитель.
— НИЗ (~55%): живой футаж + karaoke-сабы (ключевые слова подсвечиваются красным).
PunchWord — ЕДИНСТВЕННАЯ сцена, которая занимает ВЕСЬ кадр (кульминация). Остальные сцены живут в верхней полосе.

МЕТОД (по шагам):
1) Найди арку: хук → завязка → кульминация → вопрос/решение.
2) Тема по тону: razbor (светлая, бытовое), dosie (тёмная, тяжёлое/криминал), krasny (агрессивное). Уважай themeHint если дан.
3) topic — короткий заголовок ВЕРХНЕГО HUD (напр. "РАЗБОР · ИЗМЕНА").
4) chapters — 3–5 СЛОВ капсом для степпера (этапы истории).
5) На каждый смысловой бит — РОВНО ОДНА сцена из КАТАЛОГА ниже. Один фокус на бит.
6) Кульминация = РОВНО ОДИН PunchWord (shatter:true на самом остром моменте).
7) 0–1 ImageInsert на реальный объект (query=реальное фото из стока, prompt=абстракт/бренд).

КАТАЛОГ СЦЕН (только эти type; поля точно такие):
• StoryStepper: { steps:[{label≤048,caption?}] (2..5), activeIndex:int, title? }
• Checklist: { items:[{text≤64,status:'bad'|'good'|'neutral'}] (1..6), title? }
• Stamp: { text≤24, sub?, rotationDeg?(-30..30), tone?('accent'|'ok'|'highlight'|'neutral') }
• DecisionCard: { verdict≤56, label?, subtitle?, tone? }
• ChatBubble: { text≤160, author?, typing?:bool, side?('left'|'right') }
• StatHud: { label≤48, value:number, progress:0..100, valuePrefix?, valueSuffix?, caption? }
• ImageInsert: { query?|prompt?|source?('search'|'generate'), caption?, eyebrow?, bw?:bool, kenBurns?('in'|'out'), orientation?('landscape'|'portrait'|'square') }
• VoiceBubble: { sender≤32, quote≤200, durationLabel?, side?, silhouette?:bool, highlightWords?:string[], bars?(8..64) }
• RelationCards: { left:{label≤24,sub?,silhouette?,accent?}, right:{...}, arrowLabel? }
• StatChips: { chips:[{label≤16,accent?}] (1..4), title? }
• SectionEyebrow: { text? ИЛИ kicker?+index?+meta?, align?('left'|'center') }
• PunchWord: { word≤24, sub?, filled?:bool, glitchOn?:bool, shatter?:bool, rotate?(-15..15) }

ЖЕСТКИЕ ПРАВИЛА:
— Верни ТОЛЬКО JSON (без комментариев/markdown/```), объект вида:
  { "src": string, "theme": "razbor"|"dosie"|"krasny", "topic": string, "chapters": string[], "scenes": Scene[] }.
— src = ровно тот, что передан в input (эхо).
— Тайминги fromMs/toMs — ЦЕЛЫЕ миллисекунды; первая сцена начинается с 0, сцены идут по порядку, БЕЗ наложений и без дыр, toMs>fromMs, последняя toMs = конец речи (durationMs из input).
— Каждая сцена соответствует тому, что говорится В ЭТОТ момент речи.
— РОВНО ОДИН PunchWord на весь ролик. Максимум 1 ImageInsert.
— Не выдумывай факты, которых нет в транскрипте. Уважай bannedWords и maxScenes.
— Не используй никаких type, кроме перечисленных в каталоге.`;

// ---------------------------------------------------------------------------
// Beat coalescing
// ---------------------------------------------------------------------------

interface Beat {
  fromMs: number;
  toMs: number;
  text: string;
}

/** Merge whisper word-captions into beats, breaking on gaps >= gapMs. */
function coalesceBeats(captions: Caption[], gapMs = 400): Beat[] {
  const beats: Beat[] = [];
  for (const c of captions) {
    const text = (c.text ?? '').trim();
    if (!text) continue;
    const last = beats[beats.length - 1];
    if (last && c.startMs - last.toMs < gapMs) {
      last.toMs = c.endMs;
      last.text = `${last.text} ${text}`.trim();
    } else {
      beats.push({ fromMs: c.startMs, toMs: c.endMs, text });
    }
  }
  return beats;
}

// ---------------------------------------------------------------------------
// Build the LLM input
// ---------------------------------------------------------------------------

export function buildDirectorInput(
  captions: Caption[],
  prefs: BrandPrefs = {},
): { system: string; user: string } {
  if (!Array.isArray(captions) || captions.length === 0) {
    throw new Error('buildDirectorInput: captions must be a non-empty Caption[]');
  }
  const words = captions
    .map((c) => ({ text: (c.text ?? '').trim(), fromMs: c.startMs, toMs: c.endMs }))
    .filter((w) => w.text.length > 0);
  const durationMs = words.reduce((m, w) => Math.max(m, w.toMs), 0);
  const beats = coalesceBeats(captions);
  const transcript = words.map((w) => w.text).join(' ');

  const user = JSON.stringify(
    {
      instruction:
        'Сделай сториборд по этой речи. Верни СТРОГИЙ JSON по схеме из system.',
      durationMs,
      fps: prefs.fps ?? 30,
      src: prefs.src ?? '',
      themeHint: prefs.themeHint ?? null,
      topicHint: prefs.topicHint ?? null,
      tone: prefs.tone ?? null,
      language: prefs.language ?? 'ru',
      bannedWords: prefs.bannedWords ?? [],
      maxScenes: prefs.maxScenes ?? 6,
      transcript,
      beats,
      words,
    },
    null,
    2,
  );

  return { system: DIRECTOR_SYSTEM_PROMPT, user };
}

// ---------------------------------------------------------------------------
// Validate the LLM output
// ---------------------------------------------------------------------------

/** Strip prose / code fences and return the first JSON object substring. */
function extractJson(raw: string): string {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  return s;
}

/**
 * Validate an LLM answer (object OR JSON string) into a BrandedReel. Throws with
 * readable zod field paths so a repair pass can fix a bad answer.
 */
export function parseDirectorOutput(input: unknown): BrandedReel {
  let data: unknown = input;
  if (typeof input === 'string') {
    data = JSON.parse(extractJson(input));
  }
  const res = safeParseBrandedReel(data);
  if (!res.success) {
    const issues = res.error.issues
      .map((i) => `• ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Director output failed validation:\n${issues}`);
  }
  return res.data;
}

/** Non-throwing variant. */
export const safeParseDirectorOutput = (input: unknown) => {
  try {
    return { success: true as const, data: parseDirectorOutput(input) };
  } catch (e) {
    return { success: false as const, error: (e as Error).message };
  }
};

// re-export for callers doing their own validation
export { brandedReelStrictSchema };

// ---------------------------------------------------------------------------
// Worked example — mirrors public/story-spetsnaz.json (real ~15s transcript:
// "я блядь в ахуе … ушёл на спецоперацию … жена мне изменяет … что мне делать").
// ---------------------------------------------------------------------------

export const EXAMPLE_STORYBOARD: BrandedReel = {
  src: 'izmena.mp4',
  theme: 'dosie',
  topic: 'РАЗБОР · ИЗМЕНА',
  chapters: ['СВО', 'ИЗМЕНА', 'РЕШЕНИЕ'],
  scenes: [
    {
      type: 'VoiceBubble',
      fromMs: 0,
      toMs: 4000,
      sender: 'ОН',
      quote: 'я в ахуе… не поверишь, что случилось',
      durationLabel: '0:04',
      highlightWords: ['ахуе', 'поверишь'],
      side: 'left',
      silhouette: true,
    },
    {
      type: 'ImageInsert',
      fromMs: 4000,
      toMs: 7200,
      eyebrow: '— ДЕЛО №1 · СВО',
      caption: 'УШЁЛ НА СПЕЦОПЕРАЦИЮ',
      query: 'russian soldier silhouette dark',
      source: 'search',
      bw: true,
      kenBurns: 'in',
      orientation: 'landscape',
    },
    {
      type: 'RelationCards',
      fromMs: 7200,
      toMs: 10200,
      left: { label: 'Я', sub: 'НА СВО', silhouette: true },
      right: { label: 'ЖЕНА', sub: 'ДОМА', silhouette: true, accent: true },
      arrowLabel: 'ИЗМЕНА',
    },
    {
      type: 'PunchWord',
      fromMs: 10200,
      toMs: 12800,
      word: 'ИЗМЕНА',
      sub: 'пока он воевал',
      filled: true,
      glitchOn: true,
      shatter: true,
      rotate: -3,
    },
    {
      type: 'DecisionCard',
      fromMs: 12800,
      toMs: 15000,
      label: 'ВОПРОС',
      verdict: 'ЧТО ДЕЛАТЬ?',
      subtitle: 'он спрашивает совета',
      tone: 'accent',
    },
  ],
};
