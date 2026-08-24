import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { BrandTheme, Tone, resolveTone } from '../themes';

/**
 * DecisionCard — an investigative verdict card.
 * `tone` picks the bar/chip color via resolveTone. Frame is LOCAL 0-based.
 */
export type DecisionCardProps = {
  theme: BrandTheme;
  font: string;
  label?: string;
  verdict?: string;
  subtitle?: string;
  tone?: Tone;
};

export const DecisionCard: React.FC<DecisionCardProps> = ({
  theme,
  font,
  label = 'ВЕРДИКТ',
  verdict = 'ВИНОВЕН',
  subtitle,
  tone = 'accent',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const t = resolveTone(theme, tone);
  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.7 } });
  const barGrow = spring({ frame: frame - 8, fps, config: { damping: 200 } });

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'stretch',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          background: theme.surfaceAlt,
          border: `2px solid ${theme.border}`,
          borderRadius: 30,
          overflow: 'hidden',
          boxShadow: `0 26px 66px ${theme.bg}55`,
          opacity: enter,
          transform: `translateY(${interpolate(enter, [0, 1], [34, 0])}px) scale(${interpolate(
            enter,
            [0, 1],
            [0.96, 1],
          )})`,
        }}
      >
        {/* tone accent bar */}
        <div style={{ height: 12, background: theme.border, position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              width: `${interpolate(barGrow, [0, 1], [0, 100])}%`,
              background: t.fill,
            }}
          />
        </div>

        <div style={{ padding: '30px 34px 36px' }}>
          <div
            style={{
              display: 'inline-block',
              fontFamily: font,
              fontWeight: 700,
              fontSize: 24,
              letterSpacing: 4,
              color: t.on,
              background: t.fill,
              padding: '6px 16px',
              borderRadius: 8,
              textTransform: 'uppercase',
              marginBottom: 18,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontFamily: font,
              fontWeight: 900,
              fontSize: 92,
              lineHeight: 0.96,
              letterSpacing: 1,
              color: theme.text,
              textTransform: 'uppercase',
            }}
          >
            {verdict}
          </div>
          {subtitle ? (
            <div
              style={{
                marginTop: 18,
                fontFamily: font,
                fontWeight: 700,
                fontSize: 32,
                lineHeight: 1.15,
                color: theme.sub,
                textTransform: 'uppercase',
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default DecisionCard;
