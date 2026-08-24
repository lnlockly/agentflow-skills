// src/BrandedReel/scenes/StatChips.tsx
// A centered row of 2-4 stat chips (e.g. 01:40 / КЛУБ / ×4). One chip can be
// the accent (filled). Chips pop in staggered.
// Contract: props {fromMs?,toMs?,theme,font,...data}; position:absolute inset:0,
// box-confined, LOCAL 0-based frame, no absolute-time self-cull.

import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import type { BrandTheme } from '../themes';
import { hexToRgba } from '../effects';

export type StatChip = { label: string; accent?: boolean };
export type StatChipsProps = {
  fromMs?: number;
  toMs?: number;
  theme: BrandTheme;
  font: string;
  chips: StatChip[];
  title?: string;
};

export const StatChips: React.FC<StatChipsProps> = ({ theme, font, chips, title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const items = (chips ?? []).slice(0, 4);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 26,
        padding: '0 56px',
      }}
    >
      {title ? (
        <span
          style={{
            fontFamily: font,
            fontWeight: 700,
            fontSize: 26,
            letterSpacing: 4,
            textTransform: 'uppercase',
            color: theme.sub,
            opacity: interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          {title}
        </span>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'center', alignItems: 'center' }}>
        {items.map((chip, i) => {
          const delay = 4 + i * 5;
          const pop = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 12, mass: 0.7 } });
          const scale = interpolate(pop, [0, 1], [0.6, 1]);
          const opacity = interpolate(pop, [0, 1], [0, 1]);
          const isAccent = !!chip.accent;
          return (
            <div
              key={i}
              style={{
                transform: `scale(${scale})`,
                opacity,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '18px 30px',
                borderRadius: 18,
                background: isAccent ? theme.accent : theme.surface,
                border: `2px solid ${isAccent ? theme.accent : theme.border}`,
                boxShadow: isAccent ? `0 10px 30px ${hexToRgba(theme.accent, 0.4)}` : `0 8px 22px ${hexToRgba('#000000', theme.dark ? 0.45 : 0.14)}`,
              }}
            >
              {isAccent ? <span style={{ width: 10, height: 10, borderRadius: 5, background: theme.accentText }} /> : null}
              <span
                style={{
                  fontFamily: font,
                  fontWeight: 900,
                  fontSize: 42,
                  lineHeight: 1,
                  letterSpacing: 1,
                  color: isAccent ? theme.accentText : theme.text,
                  whiteSpace: 'nowrap',
                }}
              >
                {chip.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StatChips;
