/**
 * src/BrandedReel/themes.ts
 *
 * SINGLE SOURCE OF TRUTH for the branded overlay layer that sits on top of the
 * proven template-tiktok caption engine (see src/CaptionedVideo/*).
 *
 * Contains:
 *   - BrandTheme interface (every color/role key, fully typed)
 *   - THEMES: the three WCAG-checked palettes (razbor / dosie / krasny)
 *   - resolveBrandTheme(name): safe lookup, DEFAULTS to `razbor` (light)
 *   - Tone + resolveTone(theme,tone): semantic accent role -> {fill,on} tokens
 *   - Font tokens (weights + fallback stack; family is threaded from load-font)
 *   - Layout geometry (CANVAS, OVERLAY_BAND, TOP_SCRIM, CAPTION_BAND, CARD)
 *   - msToFrames / framesToMs / sceneWindow time helpers (30fps)
 *
 * Theme ids are ASCII (razbor | dosie | krasny) so the zod discriminator and
 * JSON stay portable; the `dosie` palette is the "досье" dark look.
 */

/* ------------------------------------------------------------------ */
/* Theme names                                                         */
/* ------------------------------------------------------------------ */

export const BRAND_THEME_NAMES = ['razbor', 'dosie', 'krasny'] as const;
export type BrandThemeName = (typeof BRAND_THEME_NAMES)[number];

export const DEFAULT_BRAND_THEME: BrandThemeName = 'razbor';

/* ------------------------------------------------------------------ */
/* Theme shape                                                         */
/* ------------------------------------------------------------------ */

/**
 * A fully-resolved brand theme. Every role is required so scenes can rely on
 * `theme.X` always being present.
 *
 *   bg            — page/backdrop tone (footage covers most of it; scrims/shadows).
 *   surface       — primary card fill (Checklist/StoryStepper pending badge).
 *   surfaceAlt    — secondary fill; USED FOR CARDS carrying muted `sub` text so
 *                   in krasny that text never lands on the red surface.
 *   text          — primary text on surface/surfaceAlt. High contrast.
 *   sub           — secondary/label text. In krasny only valid on dark
 *                   (surfaceAlt/bg), NEVER on the red surface.
 *   border        — hairline dividers / card outlines / node rings.
 *   accent        — brand red; primary emphasis fill.
 *   accentText    — text/icons on `accent`.
 *   highlight     — attention swatch.
 *   highlightText — text on `highlight`.
 *   ok            — success/positive (✓ rows, up-trend).
 */
export interface BrandTheme {
  name: BrandThemeName;
  dark: boolean;
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  sub: string;
  border: string;
  accent: string;
  accentText: string;
  highlight: string;
  highlightText: string;
  ok: string;
}

/* ------------------------------------------------------------------ */
/* The three themes (contrast pre-verified WCAG)                       */
/* ------------------------------------------------------------------ */

/** razbor — LIGHT, DEFAULT. Warm paper look, red accent, yellow marker. */
const razbor: BrandTheme = {
  name: 'razbor',
  dark: false,
  bg: '#F4F1EA',
  surface: '#FFFFFF',
  surfaceAlt: '#FBFAF6',
  text: '#14110F',
  sub: '#6B655C',
  border: '#E3DED2',
  accent: '#E0202C',
  accentText: '#FFFFFF',
  highlight: '#FFE24B',
  highlightText: '#14110F',
  ok: '#1F9D57',
};

/** dosie — DARK but readable. Cool graphite "досье" look. */
const dosie: BrandTheme = {
  name: 'dosie',
  dark: true,
  bg: '#16181D',
  surface: '#1F232B',
  surfaceAlt: '#262B34',
  text: '#F5F6F7',
  sub: '#9AA1AC',
  border: '#2E343F',
  accent: '#FF3B3B',
  accentText: '#FFFFFF',
  highlight: '#FFC53D',
  highlightText: '#16181D',
  ok: '#35D07F',
};

/**
 * krasny — BOLD duotone. Pure black + brand red only. `surface` IS the red;
 * `surfaceAlt` is near-black for cards/rows.
 *
 * CONTRAST RULE: `sub` (#C9C9C9) is for BLACK backgrounds only. Cards that show
 * muted text fill with `surfaceAlt` (black), never `surface` (red).
 */
const krasny: BrandTheme = {
  name: 'krasny',
  dark: true,
  bg: '#0A0A0A',
  surface: '#E0202C',
  surfaceAlt: '#141414',
  text: '#FFFFFF',
  sub: '#C9C9C9',
  border: '#262626',
  accent: '#E0202C',
  accentText: '#FFFFFF',
  highlight: '#E0202C',
  highlightText: '#FFFFFF',
  ok: '#35D07F',
};

export const THEMES: Record<BrandThemeName, BrandTheme> = {
  razbor,
  dosie,
  krasny,
};

/**
 * Resolve a theme by name. Unknown / undefined / malformed input falls back to
 * the DEFAULT (razbor, light). Never throws — safe at the JSON render boundary.
 */
export function resolveBrandTheme(
  name?: BrandThemeName | string | null,
): BrandTheme {
  if (name && Object.prototype.hasOwnProperty.call(THEMES, name)) {
    return THEMES[name as BrandThemeName];
  }
  return THEMES[DEFAULT_BRAND_THEME];
}

/* ------------------------------------------------------------------ */
/* Tones — semantic accent roles resolved to concrete tokens           */
/* ------------------------------------------------------------------ */

/** Semantic accent a scene may request; mapped to real tokens per theme. */
export type Tone = 'accent' | 'ok' | 'highlight' | 'neutral';

/**
 * Resolve a Tone to a {fill, on} token pair (fill = surface color, on = text on
 * that fill). Keeps contrast theme-correct and centralizes the krasny rule.
 */
export function resolveTone(
  theme: BrandTheme,
  tone: Tone,
): { fill: string; on: string } {
  switch (tone) {
    case 'ok':
      return { fill: theme.ok, on: theme.accentText };
    case 'highlight':
      return { fill: theme.highlight, on: theme.highlightText };
    case 'neutral':
      return { fill: theme.surfaceAlt, on: theme.text };
    case 'accent':
    default:
      return { fill: theme.accent, on: theme.accentText };
  }
}

/* ------------------------------------------------------------------ */
/* Fonts                                                               */
/* ------------------------------------------------------------------ */

/**
 * The overlay layer uses one family (Montserrat, loaded via src/load-font.ts as
 * TheBoldFont) with two weights. Scenes receive the resolved family string via
 * the `font` prop and pick fontWeight inline (900 display / 700 hud).
 */
export const FONT_FALLBACK =
  "'Montserrat', 'Helvetica Neue', Arial, system-ui, sans-serif";

export const FONT_WEIGHTS = {
  display: 900,
  hud: 700,
} as const;

export interface FontSet {
  family: string;
  display: number;
  hud: number;
  fallback: string;
}

export function makeFontSet(resolvedFamily: string): FontSet {
  return {
    family: resolvedFamily,
    display: FONT_WEIGHTS.display,
    hud: FONT_WEIGHTS.hud,
    fallback: FONT_FALLBACK,
  };
}

export function fontStack(font: FontSet): string {
  return `${font.family}, ${font.fallback}`;
}

/* ------------------------------------------------------------------ */
/* Geometry / layout (all in px, 1080x1920 canvas)                     */
/* ------------------------------------------------------------------ */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const CANVAS = {
  width: 1080,
  height: 1920,
  fps: 30,
  gutter: 60,
  centerX: 540,
} as const;

/** Usable content width after both gutters (1080 - 2*60 = 960). */
export const CONTENT_WIDTH = CANVAS.width - CANVAS.gutter * 2;

/**
 * OVERLAY BAND — the TOP band every branded scene lives in (y 150..640).
 * Scenes render position:absolute inset:0 INSIDE a container placed at this rect
 * (frame is LOCAL 0-based; timing is the parent Sequence's job).
 */
export const OVERLAY_BAND: Rect = {
  x: CANVAS.gutter,
  y: 150,
  width: CONTENT_WIDTH,
  height: 490, // 640 - 150
};

/** TOP SCRIM — darkening gradient over the top for overlay readability. */
export const TOP_SCRIM = {
  height: 700,
  topOpacity: 0.55,
  bottomOpacity: 0,
} as const;

/**
 * CAPTION BAND — where template-tiktok's Page.tsx places captions (bottom:350,
 * height:150). Documented as reserved so overlay scenes never intrude.
 */
export const CAPTION_BAND: Rect = {
  x: CANVAS.gutter,
  y: CANVAS.height - 350 - 150, // 1420
  width: CONTENT_WIDTH,
  height: 150,
};

/** Shared card geometry tokens. */
export const CARD = {
  radius: 28,
  padX: 40,
  padY: 32,
  gap: 20,
  borderWidth: 3,
  shadow: '0 18px 60px rgba(0,0,0,0.35)',
} as const;

/* ------------------------------------------------------------------ */
/* Time helpers (30fps — matches CaptionedVideo metadata)              */
/* ------------------------------------------------------------------ */

export function msToFrames(ms: number, fps: number = CANVAS.fps): number {
  return Math.round((ms / 1000) * fps);
}

export function framesToMs(frames: number, fps: number = CANVAS.fps): number {
  return (frames / fps) * 1000;
}

export function sceneWindow(
  fromMs: number,
  toMs: number,
  fps: number = CANVAS.fps,
): { from: number; durationInFrames: number } {
  const from = msToFrames(fromMs, fps);
  const end = msToFrames(toMs, fps);
  return { from, durationInFrames: Math.max(1, end - from) };
}
