/**
 * BrandedReel — Storyboard contract (SINGLE source of truth for scene shapes).
 *
 * The LLM director emits a Storyboard as JSON; the compositor consumes it and
 * renders one <Sequence> per Scene on the BRANDED OVERLAY TRACK, on top of the
 * full-frame footage + TikTok captions from CaptionedVideo.
 *
 * INVARIANTS:
 *  - Base layer is ALWAYS full-frame footage -> screen never empty/dark.
 *  - Overlays live in a TOP band. Captions stay at bottom.
 *  - Time-exclusive: at most ONE overlay on screen at once (non-overlap refine).
 *  - Scenes are theme/font-AGNOSTIC. `theme` lives on the Storyboard and is
 *    injected by the compositor along with the Montserrat font family.
 *  - Timing authored in MILLISECONDS; compositor converts with msToFrames().
 *
 * Stack: Remotion 4.0.x, React, zod.
 */

import { z } from 'zod';

export const FPS = 30 as const;
export const REEL_WIDTH = 1080 as const;
export const REEL_HEIGHT = 1920 as const;

/** Overlay band the compositor confines every non-full-bleed scene to. */
export const OVERLAY_BAND = { top: 150, bottom: 640, left: 60, right: 60 } as const;

/** Authored ms -> whole frames at FPS (round, so a scene never loses its last frame). */
export const msToFrames = (ms: number, fps: number = FPS): number =>
  Math.round((ms / 1000) * fps);

// ---------------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------------

/** ASCII theme ids (portable JSON, clean discriminator). */
export const THEMES = ['razbor', 'dosie', 'krasny'] as const;
export const ThemeSchema = z.enum(THEMES);
export type Theme = z.infer<typeof ThemeSchema>;

/** Semantic accents; the compositor's theme table maps each to real tokens. */
export const TONES = ['accent', 'ok', 'highlight', 'neutral'] as const;
export const ToneSchema = z.enum(TONES);
export type Tone = z.infer<typeof ToneSchema>;

// ---------------------------------------------------------------------------
// Scene timing base
// ---------------------------------------------------------------------------

const timing = {
  fromMs: z.number().int().min(0),
  toMs: z.number().int().positive(),
} as const;

// ---------------------------------------------------------------------------
// Scene schemas — EXISTING
// ---------------------------------------------------------------------------

/** StoryStepper — numbered investigative timeline 01..NN, one active node. */
export const StoryStepperScene = z.object({
  type: z.literal('StoryStepper'),
  ...timing,
  title: z.string().max(40).optional(),
  steps: z
    .array(
      z.object({
        label: z.string().min(1).max(48),
        caption: z.string().max(80).optional(),
      }),
    )
    .min(2)
    .max(5),
  activeIndex: z.number().int().min(0),
});
export type StoryStepperScene = z.infer<typeof StoryStepperScene>;

/** Checklist — ✗/✓/• rows. status: bad=✗, good=✓, neutral=•. */
export const ChecklistScene = z.object({
  type: z.literal('Checklist'),
  ...timing,
  title: z.string().max(48).optional(),
  items: z
    .array(
      z.object({
        text: z.string().min(1).max(64),
        status: z.enum(['bad', 'good', 'neutral']).default('bad'),
      }),
    )
    .min(1)
    .max(6),
});
export type ChecklistScene = z.infer<typeof ChecklistScene>;

/** Stamp — one rotated distressed word slammed on screen. */
export const StampScene = z.object({
  type: z.literal('Stamp'),
  ...timing,
  text: z.string().min(1).max(24),
  sub: z.string().max(48).optional(),
  rotationDeg: z.number().min(-30).max(30).default(-12),
  tone: ToneSchema.default('accent'),
});
export type StampScene = z.infer<typeof StampScene>;

/** DecisionCard — a verdict card. */
export const DecisionCardScene = z.object({
  type: z.literal('DecisionCard'),
  ...timing,
  label: z.string().max(24).optional(),
  verdict: z.string().min(1).max(56),
  subtitle: z.string().max(80).optional(),
  tone: ToneSchema.default('accent'),
});
export type DecisionCardScene = z.infer<typeof DecisionCardScene>;

/** ChatBubble — a subscriber quote that types in. */
export const ChatBubbleScene = z.object({
  type: z.literal('ChatBubble'),
  ...timing,
  text: z.string().min(1).max(160),
  author: z.string().max(32).optional(),
  typing: z.boolean().default(true),
  side: z.enum(['left', 'right']).default('left'),
});
export type ChatBubbleScene = z.infer<typeof ChatBubbleScene>;

/** StatHud — topic label + rolling number + progress bar (0..100). */
export const StatHudScene = z.object({
  type: z.literal('StatHud'),
  ...timing,
  label: z.string().min(1).max(48),
  value: z.number(),
  valuePrefix: z.string().max(4).optional(),
  valueSuffix: z.string().max(4).optional(),
  progress: z.number().min(0).max(100),
  caption: z.string().max(64).optional(),
});
export type StatHudScene = z.infer<typeof StatHudScene>;

// ---------------------------------------------------------------------------
// Scene schemas — NEW (dосье premium set + image inserts)
// ---------------------------------------------------------------------------

/**
 * ImageInsert — a framed photo (B&W lecture hall / club / soldier) in the top
 * band with Ken Burns push + caption + section eyebrow. The `query` / `prompt` /
 * `source` fields are consumed by scripts/fetch-assets.mjs, which downloads the
 * image and writes back `src`; the <ImageInsert/> component renders `src`.
 */
export const ImageInsertScene = z.object({
  type: z.literal('ImageInsert'),
  ...timing,
  /** Optional stable id -> asset filename public/assets/<id>.jpg. */
  id: z.string().regex(/^[a-z0-9_-]+$/i).max(48).optional(),
  // --- pipeline inputs (scripts/fetch-assets.mjs) ---
  source: z.enum(['search', 'generate']).optional(),
  query: z.string().max(160).optional(),
  prompt: z.string().max(600).optional(),
  branded: z.boolean().optional(),
  abstract: z.boolean().optional(),
  orientation: z.enum(['landscape', 'portrait', 'square']).optional(),
  model: z.string().max(64).optional(),
  credit: z.string().max(120).optional(),
  // --- render inputs (<ImageInsert/>) ---
  src: z.string().optional(),
  caption: z.string().max(80).optional(),
  eyebrow: z.string().max(48).optional(),
  bw: z.boolean().optional(),
  kenBurns: z.enum(['in', 'out']).optional(),
});
export type ImageInsertScene = z.infer<typeof ImageInsertScene>;

/** VoiceBubble — Telegram-style voice message: silhouette + waveform + quote. */
export const VoiceBubbleScene = z.object({
  type: z.literal('VoiceBubble'),
  ...timing,
  sender: z.string().min(1).max(32),
  quote: z.string().min(1).max(200),
  durationLabel: z.string().max(8).optional(),
  side: z.enum(['left', 'right']).optional(),
  silhouette: z.boolean().optional(),
  bars: z.number().int().min(8).max(64).optional(),
  highlightWords: z.array(z.string().max(40)).max(8).optional(),
  seed: z.number().int().optional(),
});
export type VoiceBubbleScene = z.infer<typeof VoiceBubbleScene>;

/** RelationCards — two labeled cards linked by an animated red arrow (Я → ЖЕНА). */
const relationParty = z.object({
  label: z.string().min(1).max(24),
  sub: z.string().max(24).optional(),
  silhouette: z.boolean().optional(),
  accent: z.boolean().optional(),
});
export const RelationCardsScene = z.object({
  type: z.literal('RelationCards'),
  ...timing,
  left: relationParty,
  right: relationParty,
  arrowLabel: z.string().max(24).optional(),
});
export type RelationCardsScene = z.infer<typeof RelationCardsScene>;

/** StatChips — a centered row of 2-4 stat chips (01:40 / КЛУБ / ×4). */
export const StatChipsScene = z.object({
  type: z.literal('StatChips'),
  ...timing,
  title: z.string().max(48).optional(),
  chips: z
    .array(z.object({ label: z.string().min(1).max(16), accent: z.boolean().optional() }))
    .min(1)
    .max(4),
});
export type StatChipsScene = z.infer<typeof StatChipsScene>;

/** SectionEyebrow — a small "— ДЕЛО №N · META" header; overlay-friendly. */
export const SectionEyebrowScene = z.object({
  type: z.literal('SectionEyebrow'),
  ...timing,
  text: z.string().max(64).optional(),
  kicker: z.string().max(24).optional(),
  index: z.number().int().min(0).optional(),
  meta: z.string().max(24).optional(),
  align: z.enum(['left', 'center']).optional(),
});
export type SectionEyebrowScene = z.infer<typeof SectionEyebrowScene>;

/** PunchWord — full-bleed accent takeover with ONE huge word (climax beat). */
export const PunchWordScene = z.object({
  type: z.literal('PunchWord'),
  ...timing,
  word: z.string().min(1).max(24),
  sub: z.string().max(32).optional(),
  filled: z.boolean().optional(),
  glitchOn: z.boolean().optional(),
  shatter: z.boolean().optional(),
  rotate: z.number().min(-15).max(15).optional(),
});
export type PunchWordScene = z.infer<typeof PunchWordScene>;

// ---------------------------------------------------------------------------
// Scene union + Storyboard
// ---------------------------------------------------------------------------

export const SCENE_TYPES = [
  'StoryStepper',
  'Checklist',
  'Stamp',
  'DecisionCard',
  'ChatBubble',
  'StatHud',
  'ImageInsert',
  'VoiceBubble',
  'RelationCards',
  'StatChips',
  'SectionEyebrow',
  'PunchWord',
] as const;
export type SceneType = (typeof SCENE_TYPES)[number];

export const SceneSchema = z
  .discriminatedUnion('type', [
    StoryStepperScene,
    ChecklistScene,
    StampScene,
    DecisionCardScene,
    ChatBubbleScene,
    StatHudScene,
    ImageInsertScene,
    VoiceBubbleScene,
    RelationCardsScene,
    StatChipsScene,
    SectionEyebrowScene,
    PunchWordScene,
  ])
  .superRefine((scene, ctx) => {
    if (scene.toMs <= scene.fromMs) {
      ctx.addIssue({
        code: 'custom',
        message: `Scene "${scene.type}": toMs (${scene.toMs}) must be greater than fromMs (${scene.fromMs}).`,
        path: ['toMs'],
      });
    }
    if (scene.type === 'StoryStepper' && scene.activeIndex > scene.steps.length - 1) {
      ctx.addIssue({
        code: 'custom',
        message: `StoryStepper.activeIndex (${scene.activeIndex}) is out of range for ${scene.steps.length} steps.`,
        path: ['activeIndex'],
      });
    }
  });
export type Scene = z.infer<typeof SceneSchema>;

/** Shared refine: overlays are time-exclusive (at most one on screen at once). */
const refineNoOverlap = (
  scenes: { fromMs: number; toMs: number; type: string }[],
  ctx: z.RefinementCtx,
) => {
  const ordered = scenes.map((s, i) => ({ s, i })).sort((a, b) => a.s.fromMs - b.s.fromMs);
  for (let k = 1; k < ordered.length; k++) {
    const prev = ordered[k - 1];
    const cur = ordered[k];
    if (cur.s.fromMs < prev.s.toMs) {
      ctx.addIssue({
        code: 'custom',
        message:
          `Scenes overlap: "${prev.s.type}" (${prev.s.fromMs}-${prev.s.toMs}ms) ` +
          `and "${cur.s.type}" (${cur.s.fromMs}-${cur.s.toMs}ms). ` +
          `Overlays must be time-exclusive (at most one on screen at once).`,
        path: ['scenes', cur.i],
      });
    }
  }
};

/** Legacy shape ({topic, theme, scenes}) — kept for back-compat. */
export const StoryboardSchema = z
  .object({
    topic: z.string().min(1).max(120),
    theme: ThemeSchema.default('razbor'),
    scenes: z.array(SceneSchema).min(1).max(24),
  })
  .superRefine((sb, ctx) => refineNoOverlap(sb.scenes, ctx));
export type Storyboard = z.infer<typeof StoryboardSchema>;

export const parseStoryboard = (data: unknown): Storyboard =>
  StoryboardSchema.parse(data);
export const safeParseStoryboard = (data: unknown) =>
  StoryboardSchema.safeParse(data);
export const storyboardEndMs = (sb: { scenes: { toMs: number }[] }): number =>
  sb.scenes.reduce((max, s) => Math.max(max, s.toMs), 0);

// ---------------------------------------------------------------------------
// BrandedReel prop shape — the FULL render payload the director emits and the
// compositor consumes ({src, theme, topic, chapters, scenes}). Defined HERE
// (not in index.tsx) so the Node-side director can import it without React.
// ---------------------------------------------------------------------------

/** Composition schema (lenient defaults) — used by Root.tsx <Composition schema>. */
export const brandedReelSchema = z.object({
  src: z.string(),
  theme: ThemeSchema.default('razbor'),
  topic: z.string().default(''),
  /** persistent top stepper labels (the reference "УНИВЕР→...→ПРОСТИЛ" row) */
  chapters: z.array(z.string()).default([]),
  scenes: z.array(SceneSchema).default([]),
});
export type BrandedReelProps = z.infer<typeof brandedReelSchema>;
export type BrandedReel = BrandedReelProps;

/** Strict schema for validating LLM director output (used by director.ts). */
export const brandedReelStrictSchema = z
  .object({
    src: z.string().min(1),
    theme: ThemeSchema,
    topic: z.string().min(1).max(120),
    chapters: z.array(z.string().min(1).max(24)).min(1).max(8),
    scenes: z.array(SceneSchema).min(1).max(24),
  })
  .superRefine((sb, ctx) => refineNoOverlap(sb.scenes, ctx));

export const parseBrandedReel = (data: unknown): BrandedReel =>
  brandedReelStrictSchema.parse(data);
export const safeParseBrandedReel = (data: unknown) =>
  brandedReelStrictSchema.safeParse(data);
