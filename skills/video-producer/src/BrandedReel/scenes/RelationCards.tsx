// src/BrandedReel/scenes/RelationCards.tsx
// Two labeled cards linked by an animated red arrow (e.g. Я → ЖЕНА). Optional
// silhouette icons. Cards spring in staggered, then the arrow draws.
// Contract: props {fromMs?,toMs?,theme,font,...data}; position:absolute inset:0,
// box-confined, LOCAL 0-based frame, no absolute-time self-cull.

import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import type { BrandTheme } from '../themes';
import { Silhouette, hexToRgba } from '../effects';

export type RelationParty = {
  label: string;
  sub?: string;
  silhouette?: boolean;
  accent?: boolean;
};
export type RelationCardsProps = {
  fromMs?: number;
  toMs?: number;
  theme: BrandTheme;
  font: string;
  left: RelationParty;
  right: RelationParty;
  arrowLabel?: string;
};

const Card: React.FC<{
  party: RelationParty;
  theme: BrandTheme;
  font: string;
  progress: number;
}> = ({ party, theme, font, progress }) => {
  const scale = interpolate(progress, [0, 1], [0.7, 1]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const isAccent = !!party.accent;
  return (
    <div
      style={{
        transform: `scale(${scale})`,
        opacity,
        flex: '0 0 auto',
        width: 300,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        padding: '26px 20px',
        borderRadius: 24,
        background: isAccent ? theme.accent : theme.surface,
        border: `2px solid ${isAccent ? theme.accent : theme.border}`,
        boxShadow: isAccent
          ? `0 12px 34px ${hexToRgba(theme.accent, 0.45)}`
          : `0 12px 30px ${hexToRgba('#000000', theme.dark ? 0.5 : 0.15)}`,
      }}
    >
      {party.silhouette !== false ? (
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            background: isAccent ? hexToRgba(theme.accentText, 0.16) : theme.surfaceAlt,
            border: `2px solid ${isAccent ? hexToRgba(theme.accentText, 0.4) : theme.border}`,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <Silhouette color={isAccent ? theme.accentText : theme.accent} size={84} />
        </div>
      ) : null}
      <span
        style={{
          fontFamily: font,
          fontWeight: 900,
          fontSize: 40,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: isAccent ? theme.accentText : theme.text,
          textAlign: 'center',
          lineHeight: 1.05,
        }}
      >
        {party.label}
      </span>
      {party.sub ? (
        <span style={{ fontFamily: font, fontWeight: 700, fontSize: 24, color: isAccent ? hexToRgba(theme.accentText, 0.85) : theme.sub, textAlign: 'center' }}>
          {party.sub}
        </span>
      ) : null}
    </div>
  );
};

export const RelationCards: React.FC<RelationCardsProps> = ({ theme, font, left, right, arrowLabel }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const leftIn = spring({ frame, fps, config: { damping: 13, mass: 0.7 } });
  const rightIn = spring({ frame: Math.max(0, frame - 6), fps, config: { damping: 13, mass: 0.7 } });
  const arrowDraw = spring({ frame: Math.max(0, frame - 14), fps, config: { damping: 200 }, durationInFrames: 12 });
  const headPop = spring({ frame: Math.max(0, frame - 22), fps, config: { damping: 10, mass: 0.5 } });

  const ARROW_W = 150;
  const dash = 120;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 30px' }}>
      <Card party={left} theme={theme} font={font} progress={leftIn} />

      <div style={{ position: 'relative', width: ARROW_W, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={ARROW_W} height={120} viewBox={`0 0 ${ARROW_W} 120`} aria-hidden="true" style={{ overflow: 'visible' }}>
          <line
            x1={6}
            y1={60}
            x2={ARROW_W - 34}
            y2={60}
            stroke={theme.accent}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={dash}
            strokeDashoffset={dash * (1 - arrowDraw)}
            style={{ filter: `drop-shadow(0 0 8px ${hexToRgba(theme.accent, 0.6)})` }}
          />
          <path
            d={`M ${ARROW_W - 40} 40 L ${ARROW_W - 8} 60 L ${ARROW_W - 40} 80 Z`}
            fill={theme.accent}
            style={{ transformOrigin: `${ARROW_W - 24}px 60px`, transform: `scale(${interpolate(headPop, [0, 1], [0, 1])})`, filter: `drop-shadow(0 0 8px ${hexToRgba(theme.accent, 0.6)})` }}
          />
        </svg>
        {arrowLabel ? (
          <span
            style={{
              position: 'absolute',
              top: 8,
              fontFamily: font,
              fontWeight: 900,
              fontSize: 22,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: theme.accent,
              opacity: interpolate(headPop, [0, 1], [0, 1]),
              whiteSpace: 'nowrap',
            }}
          >
            {arrowLabel}
          </span>
        ) : null}
      </div>

      <Card party={right} theme={theme} font={font} progress={rightIn} />
    </div>
  );
};

export default RelationCards;
