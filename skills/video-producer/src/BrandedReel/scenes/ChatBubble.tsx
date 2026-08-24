import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { BrandTheme } from '../themes';

/**
 * ChatBubble — a subscriber quote that types itself in.
 * Reveal is frame-driven (LOCAL 0-based); parent <Sequence> owns timing.
 */
export type ChatBubbleProps = {
  theme: BrandTheme;
  font: string;
  author?: string;
  text?: string;
  typing?: boolean;
  side?: 'left' | 'right';
  speed?: number;
};

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  theme,
  font,
  author = 'ПОДПИСЧИК',
  text = 'А что если он был прав?',
  typing = true,
  side = 'left',
  speed = 0.9,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.6 } });

  const TYPING_FRAMES = typing ? 12 : 0;
  const revealFrame = Math.max(0, frame - TYPING_FRAMES);
  const shownCount = typing ? Math.floor(revealFrame * speed) : text.length;
  const shown = text.slice(0, shownCount);
  const showDots = typing && frame < TYPING_FRAMES;
  const done = shownCount >= text.length;
  const caretOn = typing && !done && Math.floor(frame / 8) % 2 === 0;

  const initial = (author.trim()[0] || '?').toUpperCase();
  const isRight = side === 'right';

  const avatar = (
    <div
      style={{
        width: 72,
        height: 72,
        flex: '0 0 72px',
        borderRadius: '50%',
        background: theme.accent,
        color: theme.accentText,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: font,
        fontWeight: 900,
        fontSize: 34,
      }}
    >
      {initial}
    </div>
  );

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
          display: 'flex',
          flexDirection: isRight ? 'row-reverse' : 'row',
          alignItems: 'flex-end',
          gap: 18,
          opacity: enter,
          transform: `translateY(${interpolate(enter, [0, 1], [26, 0])}px)`,
        }}
      >
        {avatar}
        <div
          style={{
            position: 'relative',
            flex: 1,
            minWidth: 0,
            background: theme.surfaceAlt,
            border: `2px solid ${theme.border}`,
            borderRadius: 26,
            borderBottomLeftRadius: isRight ? 26 : 6,
            borderBottomRightRadius: isRight ? 6 : 26,
            padding: '20px 24px',
            boxShadow: `0 18px 46px ${theme.bg}44`,
          }}
        >
          <div
            style={{
              fontFamily: font,
              fontWeight: 700,
              fontSize: 24,
              letterSpacing: 2,
              color: theme.accent,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            {author}
          </div>

          {showDots ? (
            <div style={{ display: 'flex', gap: 8, padding: '6px 2px' }}>
              {[0, 1, 2].map((d) => {
                const dotOpacity = 0.35 + 0.65 * (Math.sin((frame + d * 4) * 0.5) * 0.5 + 0.5);
                return (
                  <div
                    key={d}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: theme.sub,
                      opacity: dotOpacity,
                    }}
                  />
                );
              })}
            </div>
          ) : (
            <div
              style={{
                fontFamily: font,
                fontWeight: 700,
                fontSize: 40,
                lineHeight: 1.15,
                color: theme.text,
              }}
            >
              {shown}
              {caretOn ? <span style={{ color: theme.accent }}>|</span> : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;
