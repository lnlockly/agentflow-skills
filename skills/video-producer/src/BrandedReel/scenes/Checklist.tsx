import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { BrandTheme } from '../themes';

/**
 * Checklist — investigative ✗/✓/• rows on a readable surfaceAlt card.
 * Frame is LOCAL 0-based; parent <Sequence> owns timing (no self-cull).
 */
export type ChecklistStatus = 'bad' | 'good' | 'neutral';
export type ChecklistItem = { text: string; status: ChecklistStatus };

export type ChecklistProps = {
  theme: BrandTheme;
  font: string;
  title?: string;
  items?: ChecklistItem[];
};

export const Checklist: React.FC<ChecklistProps> = ({ theme, font, title, items = [] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rows: ChecklistItem[] = (items.length
    ? items
    : [
        { text: 'ПРОВЕРИЛ ФАКТЫ', status: 'good' },
        { text: 'НАШЁЛ УЛИКУ', status: 'good' },
        { text: 'ПОВЕРИЛ НА СЛОВО', status: 'bad' },
      ]
  ).slice(0, 6);

  const cardEnter = spring({ frame, fps, config: { damping: 200 } });

  const iconFor = (status: ChecklistStatus) => {
    if (status === 'good') return { glyph: '✓', bg: theme.ok, fg: theme.accentText };
    if (status === 'neutral') return { glyph: '•', bg: theme.border, fg: theme.text };
    return { glyph: '✗', bg: theme.accent, fg: theme.accentText };
  };

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
          padding: '28px 30px',
          boxShadow: `0 24px 60px ${theme.bg}55`,
          opacity: cardEnter,
          transform: `translateY(${interpolate(cardEnter, [0, 1], [30, 0])}px)`,
        }}
      >
        {title ? (
          <div
            style={{
              fontFamily: font,
              fontWeight: 900,
              fontSize: 34,
              letterSpacing: 1,
              color: theme.text,
              textTransform: 'uppercase',
              marginBottom: 20,
              paddingBottom: 16,
              borderBottom: `2px solid ${theme.border}`,
            }}
          >
            {title}
          </div>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {rows.map((row, i) => {
            const enter = spring({ frame: frame - 6 - i * 5, fps, config: { damping: 200, mass: 0.6 } });
            const icon = iconFor(row.status);
            const strike = row.status === 'bad';
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  opacity: enter,
                  transform: `translateX(${interpolate(enter, [0, 1], [-24, 0])}px)`,
                }}
              >
                <div
                  style={{
                    width: 58,
                    height: 58,
                    flex: '0 0 58px',
                    borderRadius: 16,
                    background: icon.bg,
                    color: icon.fg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: font,
                    fontWeight: 900,
                    fontSize: 36,
                    lineHeight: 1,
                  }}
                >
                  {icon.glyph}
                </div>
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontFamily: font,
                    fontWeight: 700,
                    fontSize: 38,
                    lineHeight: 1.1,
                    letterSpacing: 0.3,
                    color: theme.text,
                    textTransform: 'uppercase',
                    textDecoration: strike ? 'line-through' : 'none',
                    textDecorationColor: theme.accent,
                    textDecorationThickness: 4,
                  }}
                >
                  {row.text}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Checklist;
