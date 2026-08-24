// src/BrandedReel/scenes/VoiceBubble.tsx
// Telegram-style voice message: sender label + play button + animated waveform
// bars with a moving playhead + duration, and the transcribed quote below with
// red keyword highlight.
// Contract: props {fromMs?,toMs?,theme,font,...data}; position:absolute inset:0,
// box-confined, LOCAL 0-based frame, no absolute-time self-cull.

import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import type { BrandTheme } from '../themes';
import { Silhouette, hexToRgba, mulberry } from '../effects';

export type VoiceBubbleProps = {
  fromMs?: number;
  toMs?: number;
  theme: BrandTheme;
  font: string;
  sender: string;
  quote: string;
  durationLabel?: string;
  side?: 'left' | 'right';
  silhouette?: boolean;
  bars?: number;
  highlightWords?: string[];
  seed?: number;
};

function renderQuote(quote: string, highlight: string[] | undefined, theme: BrandTheme) {
  if (!highlight || highlight.length === 0) return quote;
  const norm = (s: string) => s.toLowerCase().replace(/[.,!?…:;"«»()]/g, '');
  const set = new Set(highlight.map(norm));
  return quote.split(/(\s+)/).map((tok, i) => {
    if (set.has(norm(tok))) {
      return (
        <span key={i} style={{ color: theme.highlight, fontWeight: 900 }}>
          {tok}
        </span>
      );
    }
    return <React.Fragment key={i}>{tok}</React.Fragment>;
  });
}

export const VoiceBubble: React.FC<VoiceBubbleProps> = ({
  fromMs,
  toMs,
  theme,
  font,
  sender,
  quote,
  durationLabel = '0:14',
  side = 'left',
  silhouette = true,
  bars = 34,
  highlightWords,
  seed = 3,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const lenFrames =
    fromMs != null && toMs != null && toMs > fromMs ? ((toMs - fromMs) / 1000) * fps : 4 * fps;
  const introFrames = 12;
  const progress = interpolate(frame, [introFrames, introFrames + lenFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.7 }, durationInFrames: 16 });
  const y = interpolate(enter, [0, 1], [26, 0]);
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  const rnd = mulberry(seed);
  const baseHeights = Array.from({ length: bars }, () => 0.25 + rnd() * 0.75);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: side === 'right' ? 'flex-end' : 'flex-start',
        gap: 14,
        padding: '0 52px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity, transform: `translateY(${y}px)` }}>
        {silhouette ? (
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 27,
              background: theme.surfaceAlt,
              border: `2px solid ${theme.border}`,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <Silhouette color={theme.accent} size={46} />
          </div>
        ) : null}
        <span style={{ fontFamily: font, fontWeight: 900, fontSize: 30, letterSpacing: 2, textTransform: 'uppercase', color: theme.sub }}>
          {sender}
        </span>
      </div>

      <div
        style={{
          opacity,
          transform: `translateY(${y}px)`,
          maxWidth: '86%',
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          padding: '22px 26px',
          borderRadius: 26,
          borderTopLeftRadius: side === 'left' ? 8 : 26,
          borderTopRightRadius: side === 'right' ? 8 : 26,
          background: theme.surface,
          border: `2px solid ${theme.border}`,
          boxShadow: `0 14px 34px ${hexToRgba('#000000', theme.dark ? 0.5 : 0.16)}`,
        }}
      >
        <div
          style={{
            flex: '0 0 auto',
            width: 58,
            height: 58,
            borderRadius: 29,
            background: theme.accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 18px ${hexToRgba(theme.accent, 0.55)}`,
          }}
        >
          <svg width="22" height="24" viewBox="0 0 22 24" aria-hidden="true">
            <path d="M2 2v20l18-10z" fill={theme.accentText} />
          </svg>
        </div>

        <div style={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', gap: 4, height: 62 }}>
          {baseHeights.map((base, i) => {
            const breathe = 1 + 0.14 * Math.sin(frame * 0.5 + i * 0.7);
            const h = Math.max(0.14, Math.min(1, base * breathe));
            const passed = i / bars <= progress;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${h * 100}%`,
                  minWidth: 3,
                  borderRadius: 3,
                  background: passed ? theme.accent : hexToRgba(theme.sub, 0.4),
                }}
              />
            );
          })}
        </div>

        <span style={{ flex: '0 0 auto', fontFamily: font, fontWeight: 700, fontSize: 26, color: theme.sub, fontVariantNumeric: 'tabular-nums' }}>
          {durationLabel}
        </span>
      </div>

      <div
        style={{
          opacity: interpolate(frame, [introFrames, introFrames + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          maxWidth: '92%',
          fontFamily: font,
          fontWeight: 700,
          fontSize: 40,
          lineHeight: 1.18,
          color: theme.text,
        }}
      >
        {renderQuote(quote, highlightWords, theme)}
      </div>
    </div>
  );
};

export default VoiceBubble;
