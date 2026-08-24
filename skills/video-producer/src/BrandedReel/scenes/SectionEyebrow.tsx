// src/BrandedReel/scenes/SectionEyebrow.tsx
// A small "— ДЕЛО №N · META" section header. Usable atop other scenes (it
// pins to the top-left of the band and leaves the rest of the box free).
// Contract: props {fromMs?,toMs?,theme,font,...data}; position:absolute inset:0,
// box-confined, LOCAL 0-based frame, no absolute-time self-cull.

import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import type { BrandTheme } from '../themes';
import { hexToRgba } from '../effects';

export type SectionEyebrowProps = {
  fromMs?: number;
  toMs?: number;
  theme: BrandTheme;
  font: string;
  text?: string;
  kicker?: string;
  index?: number;
  meta?: string;
  align?: 'left' | 'center';
};

export const SectionEyebrow: React.FC<SectionEyebrowProps> = ({
  theme,
  font,
  text,
  kicker = 'ДЕЛО',
  index,
  meta,
  align = 'left',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const label =
    text ??
    ['—', kicker, index != null ? `№${index}` : null, meta ? `· ${meta}` : null]
      .filter(Boolean)
      .join(' ');

  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.6 }, durationInFrames: 14 });
  const x = interpolate(enter, [0, 1], [align === 'center' ? 0 : -28, 0]);
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
  const tickGrow = interpolate(spring({ frame: Math.max(0, frame - 3), fps, durationInFrames: 12 }), [0, 1], [0, 46]);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: 40,
          left: align === 'center' ? '50%' : 44,
          transform: `translate(${align === 'center' ? '-50%' : '0'}, 0) translateX(${x}px)`,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          opacity,
        }}
      >
        <div style={{ width: tickGrow, height: 6, background: theme.accent, borderRadius: 3, boxShadow: `0 0 12px ${hexToRgba(theme.accent, 0.6)}` }} />
        <span
          style={{
            fontFamily: font,
            fontWeight: 900,
            fontSize: 30,
            letterSpacing: 3,
            textTransform: 'uppercase',
            color: theme.sub,
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
};

export default SectionEyebrow;
