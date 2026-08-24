// src/BrandedReel/scenes/PunchWord.tsx
// Full-bleed accent takeover with ONE huge word (e.g. "ИЗМЕНА"). Shake +
// zoom-punch entrance, distressed rotation, optional glitch, and an optional
// shattered-glass overlay for the decision moment.
// Contract: props {fromMs?,toMs?,theme,font,...data}; position:absolute inset:0,
// LOCAL 0-based frame, no absolute-time self-cull. The compositor mounts this in
// a full-frame AbsoluteFill (FULL_BLEED), so inset:0 fills the whole reel.

import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { BrandTheme } from '../themes';
import { zoomPunch, shake, glitch, hexToRgba, ShatterOverlay } from '../effects';

export type PunchWordProps = {
  fromMs?: number;
  toMs?: number;
  theme: BrandTheme;
  font: string;
  word: string;
  sub?: string;
  filled?: boolean;
  glitchOn?: boolean;
  shatter?: boolean;
  rotate?: number;
};

export const PunchWord: React.FC<PunchWordProps> = ({
  theme,
  font,
  word,
  sub,
  filled = true,
  glitchOn = true,
  shatter = false,
  rotate = -3,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bg = filled ? theme.accent : theme.bg;
  const fg = filled ? theme.accentText : theme.accent;
  const subColor = filled ? hexToRgba(theme.accentText, 0.85) : theme.sub;

  const scale = zoomPunch(frame, fps, { overshoot: 1.16, settleMs: 480 });
  const sh = shake(frame, 10, 0.9, 520, fps);
  const g = glitchOn ? glitch(frame, { periodFrames: 48, burstFrames: 5, maxShift: 5 }) : { transform: 'none', filter: 'none' as string, active: false };
  const bgFlash = interpolate(frame, [0, 4, 10], [filled ? 1.6 : 1, 1, 1], { extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: bg,
        filter: `brightness(${bgFlash})`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `repeating-linear-gradient(115deg, transparent 0 22px, ${hexToRgba('#000000', 0.06)} 22px 24px)`,
          mixBlendMode: 'multiply',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          transform: `translate(${sh.x}px, ${sh.y}px) rotate(${rotate + sh.rotate}deg) scale(${scale}) ${g.transform}`,
          filter: g.filter,
          textAlign: 'center',
          padding: '0 40px',
        }}
      >
        <span
          style={{
            fontFamily: font,
            fontWeight: 900,
            fontSize: word.length > 10 ? 150 : 200,
            lineHeight: 0.92,
            letterSpacing: -2,
            textTransform: 'uppercase',
            color: fg,
            textShadow: filled ? `0 8px 0 ${hexToRgba('#000000', 0.18)}` : `0 0 30px ${hexToRgba(theme.accent, 0.5)}`,
            display: 'block',
            wordBreak: 'break-word',
          }}
        >
          {word}
        </span>
        {sub ? (
          <span
            style={{
              display: 'block',
              marginTop: 20,
              fontFamily: font,
              fontWeight: 700,
              fontSize: 42,
              letterSpacing: 3,
              textTransform: 'uppercase',
              color: subColor,
            }}
          >
            {sub}
          </span>
        ) : null}
      </div>

      {shatter ? <ShatterOverlay frame={frame} fps={fps} theme={theme} atMs={120} /> : null}
    </div>
  );
};

export default PunchWord;
