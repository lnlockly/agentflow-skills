import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { BrandTheme } from '../themes';

/**
 * StoryStepper — numbered investigative timeline (01..05) with a single active
 * node. Frame is LOCAL 0-based; the parent <Sequence> owns timing (no self-cull).
 */
export type StoryStep = { label: string; caption?: string };

export type StoryStepperProps = {
  theme: BrandTheme;
  font: string;
  title?: string;
  steps?: StoryStep[];
  activeIndex?: number;
};

export const StoryStepper: React.FC<StoryStepperProps> = ({
  theme,
  font,
  title,
  steps = [],
  activeIndex = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rows: StoryStep[] = (steps.length
    ? steps
    : [
        { label: 'ЗАВЯЗКА' },
        { label: 'УЛИКА' },
        { label: 'ПОВОРОТ' },
        { label: 'РАЗБОР' },
        { label: 'ВЕРДИКТ' },
      ]
  ).slice(0, 5);
  const active = Math.max(0, Math.min(activeIndex, rows.length - 1));

  const NODE = 74;
  const GAP = 20;
  const shadow = `0 2px 12px ${theme.bg}, 0 0 2px ${theme.bg}`;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'stretch',
        padding: '0 8px',
        boxSizing: 'border-box',
      }}
    >
      {title ? (
        <div
          style={{
            fontFamily: font,
            fontWeight: 900,
            fontSize: 34,
            letterSpacing: 2,
            color: theme.accent,
            textTransform: 'uppercase',
            marginBottom: 18,
            textShadow: shadow,
          }}
        >
          {title}
        </div>
      ) : null}

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: GAP }}>
        {/* connecting spine */}
        <div
          style={{
            position: 'absolute',
            left: NODE / 2 - 2,
            top: NODE / 2,
            bottom: NODE / 2,
            width: 4,
            background: theme.border,
            borderRadius: 2,
          }}
        />
        {rows.map((step, i) => {
          const isActive = i === active;
          const isDone = i < active;
          const enter = spring({ frame: frame - i * 4, fps, config: { damping: 200, mass: 0.6 } });
          const x = interpolate(enter, [0, 1], [40, 0]);

          const badgeBg = isActive ? theme.accent : isDone ? theme.surfaceAlt : theme.surface;
          const badgeFg = isActive ? theme.accentText : isDone ? theme.sub : theme.text;
          const labelFg = isActive ? theme.text : theme.sub;

          return (
            <div
              key={i}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 22,
                opacity: enter,
                transform: `translateX(${x}px)`,
              }}
            >
              <div
                style={{
                  width: NODE,
                  height: NODE,
                  flex: `0 0 ${NODE}px`,
                  borderRadius: '50%',
                  background: badgeBg,
                  color: badgeFg,
                  border: `3px solid ${isActive ? theme.accent : theme.border}`,
                  boxShadow: isActive ? `0 0 0 8px ${theme.accent}22` : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: font,
                  fontWeight: 900,
                  fontSize: 30,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: font,
                    fontWeight: isActive ? 900 : 700,
                    fontSize: isActive ? 44 : 36,
                    lineHeight: 1.05,
                    letterSpacing: 0.5,
                    color: labelFg,
                    textTransform: 'uppercase',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textShadow: shadow,
                  }}
                >
                  {step.label}
                </div>
                {isActive && step.caption ? (
                  <div
                    style={{
                      marginTop: 4,
                      fontFamily: font,
                      fontWeight: 700,
                      fontSize: 26,
                      lineHeight: 1.1,
                      color: theme.sub,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      textShadow: shadow,
                    }}
                  >
                    {step.caption}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StoryStepper;
