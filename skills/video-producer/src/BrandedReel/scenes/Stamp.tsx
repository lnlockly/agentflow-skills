import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { BrandTheme, Tone, resolveTone } from '../themes';

/**
 * Stamp — a rotated, distressed ALL-CAPS verdict word (e.g. "ПРОВАЛ").
 * Slams in with an overshoot spring + a tiny settle shake. No self-cull.
 */
export type StampProps = {
  theme: BrandTheme;
  font: string;
  text?: string;
  sub?: string;
  rotationDeg?: number;
  tone?: Tone;
};

export const Stamp: React.FC<StampProps> = ({
  theme,
  font,
  text = 'ПРОВАЛ',
  sub,
  rotationDeg = -12,
  tone = 'accent',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const color = resolveTone(theme, tone).fill;
  const slam = spring({ frame, fps, config: { damping: 9, mass: 0.8, stiffness: 140 } });
  const scale = interpolate(slam, [0, 1], [1.6, 1]);
  const opacity = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: 'clamp' });

  const shake =
    frame < 26
      ? Math.sin(frame * 1.6) *
        interpolate(frame, [6, 26], [3.5, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 0;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          transform: `rotate(${rotationDeg + shake}deg) scale(${scale})`,
          opacity,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            border: `7px solid ${color}`,
            outline: `2px solid ${color}`,
            outlineOffset: 6,
            borderRadius: 12,
            padding: '14px 34px',
            background: 'transparent',
            boxShadow: `inset 0 0 0 3px ${color}33`,
          }}
        >
          <div
            style={{
              fontFamily: font,
              fontWeight: 900,
              fontSize: 104,
              lineHeight: 0.92,
              letterSpacing: 2,
              color,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              textShadow: `2px 2px 0 ${color}44`,
            }}
          >
            {text}
          </div>
        </div>
        {sub ? (
          <div
            style={{
              fontFamily: font,
              fontWeight: 700,
              fontSize: 28,
              letterSpacing: 6,
              color: theme.text,
              textTransform: 'uppercase',
              textShadow: `0 2px 12px ${theme.bg}, 0 0 2px ${theme.bg}`,
            }}
          >
            {sub}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Stamp;
