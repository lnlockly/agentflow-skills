/**
 * src/BrandedReel/scenes/ImageInsert.tsx
 * ONE-FOCAL-ELEMENT beat: a photo framed inside the top band with a slow Ken
 * Burns push, optional desaturation, a section eyebrow and a caption line.
 * Contract: props {fromMs?,toMs?,theme,font,...data}; position:absolute inset:0,
 * box-confined; LOCAL 0-based frame; no absolute-time self-cull.
 * Missing `src` -> renders null so the beat still shows the HUD band.
 */

import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import type { BrandTheme } from '../themes';

export type ImageInsertProps = {
  fromMs?: number;
  toMs?: number;
  theme: BrandTheme;
  font: string;
  src?: string;
  caption?: string;
  eyebrow?: string;
  bw?: boolean;
  kenBurns?: 'in' | 'out';
};

const EASE = Easing.bezier(0.16, 1, 0.3, 1);

function resolveSrc(src: string): string {
  return /^https?:/i.test(src) || src.startsWith('data:') ? src : staticFile(src);
}

export const ImageInsert: React.FC<ImageInsertProps> = ({
  fromMs,
  toMs,
  theme,
  font,
  src,
  caption,
  eyebrow,
  bw = false,
  kenBurns = 'in',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!src) return null;

  const durFrames =
    fromMs != null && toMs != null && toMs > fromMs ? ((toMs - fromMs) / 1000) * fps : 4 * fps;

  const scale = interpolate(
    frame,
    [0, durFrames],
    kenBurns === 'out' ? [1.16, 1.04] : [1.05, 1.17],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.linear },
  );
  const driftX = interpolate(frame, [0, durFrames], kenBurns === 'out' ? [-1.5, 1.5] : [1.5, -1.5], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const enter = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE,
  });
  const enterY = (1 - enter) * 24;

  const capReveal = interpolate(frame, [8, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE,
  });

  const filter = bw ? 'grayscale(1) contrast(1.06) brightness(0.98)' : 'saturate(1.02) contrast(1.02)';

  return (
    <AbsoluteFill style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {eyebrow ? (
        <div
          style={{
            fontFamily: font,
            fontWeight: 700,
            fontSize: 26,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: theme.accent,
            opacity: enter,
          }}
        >
          {eyebrow}
        </div>
      ) : null}

      <div
        style={{
          position: 'relative',
          flex: 1,
          borderRadius: 18,
          overflow: 'hidden',
          border: `4px solid ${theme.border}`,
          boxShadow: theme.dark
            ? '0 18px 48px rgba(0,0,0,0.55)'
            : '0 18px 44px rgba(0,0,0,0.28)',
          background: theme.surfaceAlt,
          opacity: enter,
          transform: `translateY(${enterY}px)`,
        }}
      >
        <Img
          src={resolveSrc(src)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter,
            transform: `scale(${scale}) translateX(${driftX}%)`,
            transformOrigin: 'center center',
          }}
        />
        {caption ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: '42%',
              background: `linear-gradient(to top, ${theme.dark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.72)'}, rgba(0,0,0,0))`,
            }}
          />
        ) : null}

        {caption ? (
          <div
            style={{
              position: 'absolute',
              left: 20,
              right: 20,
              bottom: 18,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              opacity: capReveal,
              transform: `translateY(${(1 - capReveal) * 10}px)`,
            }}
          >
            <div style={{ width: 6, alignSelf: 'stretch', minHeight: 30, background: theme.accent, borderRadius: 3 }} />
            <div
              style={{
                fontFamily: font,
                fontWeight: 900,
                fontSize: 34,
                lineHeight: 1.05,
                color: '#fff',
                textShadow: '0 2px 8px rgba(0,0,0,0.6)',
              }}
            >
              {caption}
            </div>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

export default ImageInsert;
