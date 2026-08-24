import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { BrandTheme } from '../themes';

/**
 * StatHud — topic label + rolling number + progress bar.
 * Count-up and fill are frame-driven (LOCAL 0-based); parent <Sequence> owns timing.
 */
export type StatHudProps = {
  theme: BrandTheme;
  font: string;
  label?: string;
  value?: number;
  valuePrefix?: string;
  valueSuffix?: string;
  /** Progress 0..100 for the bar. Defaults to clamp(value). */
  progress?: number;
  caption?: string;
  countFrames?: number;
};

export const StatHud: React.FC<StatHudProps> = ({
  theme,
  font,
  label = 'ОХВАТ РАЗБОРА',
  value = 92,
  valuePrefix,
  valueSuffix = '%',
  progress,
  caption,
  countFrames = 26,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 200 } });

  const shown = Math.round(
    interpolate(frame, [0, countFrames], [0, value], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );

  const pct = progress ?? value;
  const frac = Math.max(0, Math.min(1, pct / 100));
  const fillGrow = spring({ frame: frame - 6, fps, config: { damping: 200 } });
  const fillPct = interpolate(fillGrow, [0, 1], [0, frac * 100]);

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
          borderRadius: 28,
          padding: '28px 32px',
          boxShadow: `0 22px 58px ${theme.bg}55`,
          opacity: enter,
          transform: `translateY(${interpolate(enter, [0, 1], [28, 0])}px)`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ width: 14, height: 14, borderRadius: 4, background: theme.accent }} />
          <div
            style={{
              fontFamily: font,
              fontWeight: 700,
              fontSize: 28,
              letterSpacing: 3,
              color: theme.sub,
              textTransform: 'uppercase',
            }}
          >
            {label}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 20 }}>
          {valuePrefix ? (
            <div
              style={{
                fontFamily: font,
                fontWeight: 900,
                fontSize: 56,
                lineHeight: 0.9,
                color: theme.accent,
              }}
            >
              {valuePrefix}
            </div>
          ) : null}
          <div
            style={{
              fontFamily: font,
              fontWeight: 900,
              fontSize: 118,
              lineHeight: 0.9,
              color: theme.text,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {shown}
          </div>
          {valueSuffix ? (
            <div
              style={{
                fontFamily: font,
                fontWeight: 900,
                fontSize: 56,
                lineHeight: 0.9,
                color: theme.accent,
              }}
            >
              {valueSuffix}
            </div>
          ) : null}
        </div>

        {/* progress track */}
        <div
          style={{
            position: 'relative',
            height: 22,
            borderRadius: 12,
            background: theme.bg,
            border: `2px solid ${theme.border}`,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              width: `${fillPct}%`,
              background: theme.accent,
              borderRadius: 10,
            }}
          />
        </div>

        {caption ? (
          <div
            style={{
              marginTop: 14,
              fontFamily: font,
              fontWeight: 700,
              fontSize: 24,
              letterSpacing: 1,
              color: theme.sub,
              textTransform: 'uppercase',
            }}
          >
            {caption}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default StatHud;
