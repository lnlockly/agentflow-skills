/**
 * brand.ts — Self-serve brand config for the BrandedReel producer.
 *
 * OWNER DIFFERENTIATOR: the blogger edits their own agent at RUNTIME by editing
 * a plain JSON file on a mounted volume — no image rebuild, no code. This module
 * reads that file, validates it, and merges it into a BrandTheme + font +
 * wordmark the render can use.
 *
 * WHERE IT RUNS: Node side only (Root.tsx / calculateMetadata / the render CLI
 * that builds input props). The resolved BrandTheme + font are passed as plain
 * props INTO the Remotion composition. fs access is guarded so a browser/Studio
 * bundle that imports this file degrades to safe defaults instead of throwing.
 *
 * HOT-READ: loadBrandConfig() reads brand.json fresh on every call.
 */

import { THEMES, type BrandTheme } from './themes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ThemeName = keyof typeof THEMES; // 'razbor' | 'dosie' | 'krasny'

/** Default font family shipped preloaded by the agent (see @remotion/google-fonts). */
const DEFAULT_FONT_FAMILY = 'Montserrat';

/**
 * The color tokens a blogger may override. Structural fields (`name`, `dark`)
 * are deliberately NOT here — flip light/dark by choosing a different base theme.
 */
export type PaletteOverride = Partial<
  Pick<
    BrandTheme,
    | 'bg'
    | 'surface'
    | 'surfaceAlt'
    | 'text'
    | 'sub'
    | 'border'
    | 'accent'
    | 'accentText'
    | 'highlight'
    | 'highlightText'
    | 'ok'
  >
>;

/** Fonts the agent ships preloaded. Bloggers pick from this list. */
export const FONT_CHOICES = [
  'Montserrat',
  'Oswald',
  'PT Sans',
  'Roboto Condensed',
] as const;
export type FontChoice = (typeof FONT_CHOICES)[number];

export interface BrandConfig {
  handle: string;
  logoText: string;
  defaultTheme: ThemeName;
  fontChoice: string;
  watermark: boolean;
  palette: PaletteOverride;
  themeOverrides: Partial<Record<ThemeName, PaletteOverride>>;
}

export interface ResolvedBrand {
  theme: BrandTheme;
  font: string;
  handle: string;
  logoText: string;
  watermark: boolean;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Safe defaults
// ---------------------------------------------------------------------------

const DEFAULT_THEME_NAME: ThemeName = ('razbor' in THEMES
  ? 'razbor'
  : (Object.keys(THEMES)[0] as ThemeName));

export const DEFAULT_BRAND: BrandConfig = {
  handle: '@razbor',
  logoText: 'РАЗБОР',
  defaultTheme: DEFAULT_THEME_NAME,
  fontChoice: DEFAULT_FONT_FAMILY,
  watermark: true,
  palette: {},
  themeOverrides: {},
};

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const COLOR_KEYS: (keyof PaletteOverride)[] = [
  'bg',
  'surface',
  'surfaceAlt',
  'text',
  'sub',
  'border',
  'accent',
  'accentText',
  'highlight',
  'highlightText',
  'ok',
];

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNC = /^(rgb|rgba|hsl|hsla)\(\s*[\d.,%\s/]+\)$/i;
const NAMED = /^[a-z]{3,20}$/i;

function isValidColor(v: unknown): v is string {
  return typeof v === 'string' && (HEX.test(v) || FUNC.test(v) || NAMED.test(v));
}

function sanitizePalette(input: unknown, where: string, warnings: string[]): PaletteOverride {
  const out: PaletteOverride = {};
  if (input === undefined || input === null) return out;
  if (typeof input !== 'object' || Array.isArray(input)) {
    warnings.push(`${where}: expected an object of color tokens, ignored`);
    return out;
  }
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!COLOR_KEYS.includes(k as keyof PaletteOverride)) {
      warnings.push(`${where}: unknown color "${k}", ignored`);
      continue;
    }
    if (!isValidColor(v)) {
      warnings.push(`${where}.${k}: "${String(v)}" is not a valid color, ignored`);
      continue;
    }
    out[k as keyof PaletteOverride] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

function readConfigFile(path: string): string | null {
  try {
    const req: NodeRequire | undefined =
      typeof require === 'function' ? require : undefined;
    if (!req) return null;
    const fs = req('fs') as typeof import('fs');
    if (!fs.existsSync(path)) return null;
    return fs.readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

export function loadBrandConfig(explicitPath?: string): {
  config: BrandConfig;
  warnings: string[];
} {
  const warnings: string[] = [];
  const path =
    explicitPath ||
    (typeof process !== 'undefined' ? process.env?.BRAND_CONFIG_PATH : undefined);

  if (!path) {
    return { config: { ...DEFAULT_BRAND }, warnings };
  }

  const raw = readConfigFile(path);
  if (raw === null) {
    warnings.push(`brand config not found at ${path}, using defaults`);
    return { config: { ...DEFAULT_BRAND }, warnings };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    warnings.push(
      `brand.json is not valid JSON (${(e as Error).message}), using defaults`,
    );
    return { config: { ...DEFAULT_BRAND }, warnings };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    warnings.push('brand.json must be a JSON object, using defaults');
    return { config: { ...DEFAULT_BRAND }, warnings };
  }

  const config: BrandConfig = { ...DEFAULT_BRAND };

  if (typeof parsed.handle === 'string' && parsed.handle.trim()) {
    config.handle = parsed.handle.trim();
  }
  if (typeof parsed.logoText === 'string' && parsed.logoText.trim()) {
    config.logoText = parsed.logoText.trim();
  }
  if (typeof parsed.defaultTheme === 'string') {
    if (parsed.defaultTheme in THEMES) {
      config.defaultTheme = parsed.defaultTheme as ThemeName;
    } else {
      warnings.push(
        `defaultTheme "${parsed.defaultTheme}" is not a known theme (${Object.keys(
          THEMES,
        ).join(', ')}), using ${config.defaultTheme}`,
      );
    }
  }
  if (typeof parsed.fontChoice === 'string' && parsed.fontChoice.trim()) {
    const fc = parsed.fontChoice.trim();
    if ((FONT_CHOICES as readonly string[]).includes(fc)) {
      config.fontChoice = fc;
    } else {
      warnings.push(
        `fontChoice "${fc}" is not loaded (${FONT_CHOICES.join(
          ', ',
        )}), using ${config.fontChoice}`,
      );
    }
  }
  if (typeof parsed.watermark === 'boolean') {
    config.watermark = parsed.watermark;
  }

  config.palette = sanitizePalette(parsed.palette, 'palette', warnings);

  config.themeOverrides = {};
  if (parsed.themeOverrides && typeof parsed.themeOverrides === 'object') {
    for (const [tn, ov] of Object.entries(
      parsed.themeOverrides as Record<string, unknown>,
    )) {
      if (!(tn in THEMES)) {
        warnings.push(`themeOverrides."${tn}": unknown theme, ignored`);
        continue;
      }
      config.themeOverrides[tn as ThemeName] = sanitizePalette(
        ov,
        `themeOverrides.${tn}`,
        warnings,
      );
    }
  }

  return { config, warnings };
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * Merge order (later wins):
 *   base built-in theme  ->  themeOverrides[activeTheme]  ->  global palette
 */
export function resolveTheme(
  config: BrandConfig,
  themeName?: string,
): BrandTheme {
  const active: ThemeName =
    themeName && themeName in THEMES
      ? (themeName as ThemeName)
      : config.defaultTheme;
  const base = THEMES[active];
  return {
    ...base,
    ...(config.themeOverrides[active] ?? {}),
    ...config.palette,
  };
}

export function resolveFont(config: BrandConfig): string {
  return config.fontChoice || DEFAULT_FONT_FAMILY;
}

export function resolveBrand(opts?: {
  path?: string;
  themeName?: string;
}): ResolvedBrand {
  const { config, warnings } = loadBrandConfig(opts?.path);
  return {
    theme: resolveTheme(config, opts?.themeName),
    font: resolveFont(config),
    handle: config.handle,
    logoText: config.logoText,
    watermark: config.watermark,
    warnings,
  };
}
