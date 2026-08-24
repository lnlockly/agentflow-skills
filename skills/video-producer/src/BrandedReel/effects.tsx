// src/BrandedReel/effects.tsx
// Reusable, token-driven motion helpers + inline-SVG overlays for the dosie
// premium look. Pure functions return style fragments a scene can spread onto
// an element; small components render inline SVG (no external assets).
// Everything is box-confined and driven by a LOCAL 0-based frame that the
// caller passes in (scenes read useCurrentFrame() and hand it here).

import React from 'react';
import { interpolate, Easing } from 'remotion';
import type { BrandTheme } from './themes';

// ------------------------------------------------------------------ color util
export function hexToRgba(hex: string, alpha = 1): string {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return hex; // graceful fallback for named colors
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// deterministic PRNG so every render of a scene is identical
export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ Ken Burns
export type KenBurnsOpts = {
  durMs?: number;
  from?: number;
  to?: number;
  panX?: number; // percent of element width
  panY?: number;
};
export function kenBurns(
  frame: number,
  fps: number,
  opts: KenBurnsOpts = {},
): { transform: string; transformOrigin: string } {
  const { durMs = 6000, from = 1.06, to = 1.18, panX = 3, panY = -2 } = opts;
  const dur = Math.max(1, (durMs / 1000) * fps);
  const p = interpolate(frame, [0, dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.ease),
  });
  const scale = from + (to - from) * p;
  return {
    transform: `scale(${scale.toFixed(4)}) translate(${(panX * p).toFixed(3)}%, ${(panY * p).toFixed(3)}%)`,
    transformOrigin: '50% 45%',
  };
}

// ------------------------------------------------------------------ zoom punch
export type ZoomPunchOpts = { atMs?: number; overshoot?: number; settleMs?: number; base?: number };
export function zoomPunch(frame: number, fps: number, opts: ZoomPunchOpts = {}): number {
  const { atMs = 0, overshoot = 1.14, settleMs = 520, base = 1 } = opts;
  const start = (atMs / 1000) * fps;
  const settle = Math.max(1, (settleMs / 1000) * fps);
  const peak = start + settle * 0.4;
  if (frame < peak) {
    return interpolate(frame, [start, peak], [base * 0.86, overshoot], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    });
  }
  return interpolate(frame, [peak, start + settle], [overshoot, base], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.ease),
  });
}

// ------------------------------------------------------------------ shake
export function shake(
  frame: number,
  intensity = 8,
  freq = 0.9,
  decayMs?: number,
  fps = 30,
): { x: number; y: number; rotate: number; transform: string } {
  let amp = intensity;
  if (decayMs) {
    const d = Math.max(1, (decayMs / 1000) * fps);
    amp = intensity * Math.max(0, 1 - frame / d);
  }
  const x = Math.sin(frame * freq * 2.1) * amp;
  const y = Math.cos(frame * freq * 1.7) * amp * 0.6;
  const rotate = Math.sin(frame * freq * 1.3) * (amp * 0.06);
  return { x, y, rotate, transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${rotate.toFixed(3)}deg)` };
}

// ------------------------------------------------------------------ glitch
export type GlitchOpts = { periodFrames?: number; burstFrames?: number; maxShift?: number };
export function glitch(
  frame: number,
  opts: GlitchOpts = {},
): { transform: string; filter: string; active: boolean } {
  const { periodFrames = 42, burstFrames = 6, maxShift = 4 } = opts;
  const phase = frame % periodFrames;
  if (phase >= burstFrames) return { transform: 'none', filter: 'none', active: false };
  const t = phase / burstFrames;
  const shift = Math.sin(t * Math.PI) * maxShift;
  const dir = frame % 2 === 0 ? 1 : -1;
  return {
    transform: `translateX(${(shift * dir).toFixed(2)}px)`,
    filter: `drop-shadow(${shift.toFixed(1)}px 0 0 rgba(255,0,60,0.55)) drop-shadow(${(-shift).toFixed(1)}px 0 0 rgba(0,200,255,0.45))`,
    active: true,
  };
}

// ------------------------------------------------------------------ silhouette
export const Silhouette: React.FC<{ color: string; size?: number; style?: React.CSSProperties }> = ({
  color,
  size = 120,
  style,
}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style} aria-hidden="true">
    <path
      fill={color}
      d="M50 13c9.7 0 17.5 7.9 17.5 17.7S59.7 48.4 50 48.4 32.5 40.5 32.5 30.7 40.3 13 50 13zm0 43c19.6 0 34 9.9 34 22.9V91H16V78.9C16 65.9 30.4 56 50 56z"
    />
  </svg>
);

// ------------------------------------------------------------------ shatter
export type ShatterOpts = {
  cx?: number;
  cy?: number;
  w?: number;
  h?: number;
  spokes?: number;
  rings?: number;
  seed?: number;
};
export function shatterCracks(opts: ShatterOpts = {}): {
  spokes: string[];
  rings: string[];
  cx: number;
  cy: number;
  w: number;
  h: number;
} {
  const { cx = 540, cy = 640, w = 1080, h = 1280, spokes = 12, rings = 3, seed = 7 } = opts;
  const rnd = mulberry(seed);
  const maxR = Math.hypot(w, h);
  const angles: number[] = [];
  const spokePaths: string[] = [];
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2 + (rnd() - 0.5) * 0.3;
    angles.push(a);
    let d = `M ${cx} ${cy}`;
    const steps = 5;
    for (let s = 1; s <= steps; s++) {
      const rr = (maxR / steps) * s;
      const jitter = (rnd() - 0.5) * 40;
      const px = cx + Math.cos(a) * rr + Math.cos(a + Math.PI / 2) * jitter;
      const py = cy + Math.sin(a) * rr + Math.sin(a + Math.PI / 2) * jitter;
      d += ` L ${px.toFixed(1)} ${py.toFixed(1)}`;
    }
    spokePaths.push(d);
  }
  const ringPaths: string[] = [];
  for (let r = 1; r <= rings; r++) {
    const baseR = maxR * 0.2 * r * (0.6 + rnd() * 0.35);
    let d = '';
    for (let i = 0; i <= spokes; i++) {
      const a = angles[i % spokes];
      const jitter = (rnd() - 0.5) * 24;
      const px = cx + Math.cos(a) * (baseR + jitter);
      const py = cy + Math.sin(a) * (baseR + jitter);
      d += (i === 0 ? 'M' : ' L') + ` ${px.toFixed(1)} ${py.toFixed(1)}`;
    }
    d += ' Z';
    ringPaths.push(d);
  }
  return { spokes: spokePaths, rings: ringPaths, cx, cy, w, h };
}

export const ShatterOverlay: React.FC<{
  frame: number;
  fps: number;
  theme: BrandTheme;
  atMs?: number;
  opts?: ShatterOpts;
}> = ({ frame, fps, theme, atMs = 0, opts }) => {
  const start = (atMs / 1000) * fps;
  const t = frame - start;
  if (t < 0) return null;
  const draw = interpolate(t, [0, 9], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const flash = interpolate(t, [0, 3, 10], [0.85, 0.28, 0], { extrapolateRight: 'clamp' });
  const { spokes, rings, cx, cy, w, h } = shatterCracks(opts);
  const color = theme.accent;
  const LEN = Math.round(Math.hypot(w, h) * 2);
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      <defs>
        <radialGradient id="bfShatterFlash" cx={`${((cx / w) * 100).toFixed(1)}%`} cy={`${((cy / h) * 100).toFixed(1)}%`} r="60%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={flash} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width={w} height={h} fill="url(#bfShatterFlash)" />
      <g stroke={color} fill="none" strokeOpacity={0.92} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${hexToRgba(color, 0.7)})` }}>
        {rings.map((d, i) => (
          <path key={`ring${i}`} d={d} strokeWidth={2} strokeDasharray={LEN} strokeDashoffset={LEN * (1 - draw)} />
        ))}
        {spokes.map((d, i) => (
          <path key={`spoke${i}`} d={d} strokeWidth={i % 3 === 0 ? 4 : 2} strokeDasharray={LEN} strokeDashoffset={LEN * (1 - draw)} />
        ))}
      </g>
    </svg>
  );
};
