/**
 * src/BrandedReel/index.tsx — SPLIT-LAYOUT compositor for the "разбор / досье" reel.
 *
 *   ┌─────────────────────────────┐ y0
 *   │  TOP ZONE  (theme.bg, ~45%)   │   persistent HUD (topic + % + chapter stepper)
 *   │   · HUD bar                   │   + ONE motion-graphic scene per beat
 *   │   · scene band                │
 *   ├─────────────────────────────┤ y864  red divider
 *   │  FOOTAGE ZONE (~55%)          │   talking head (OffthreadVideo, cover)
 *   │   + karaoke captions overlay  │   (template-tiktok Page at bottom:350)
 *   └─────────────────────────────┘ y1920
 *
 * PunchWord is a FULL-BLEED takeover beat (climax) — it renders over the whole
 * frame; every other scene is box-confined to the top SCENE_BAND.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  cancelRender,
  getStaticFiles,
  interpolate,
  staticFile,
  useCurrentFrame,
  useDelayRender,
  useVideoConfig,
  watchStaticFile,
  type CalculateMetadataFunction,
} from 'remotion';
import { Caption, createTikTokStyleCaptions } from '@remotion/captions';
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat';

import { calculateCaptionedVideoMetadata } from '../CaptionedVideo';
import SubtitlePage from '../CaptionedVideo/SubtitlePage';
import { loadFont } from '../load-font';
import { resolveBrandTheme, CANVAS, type BrandTheme } from './themes';
import { brandedReelSchema, type BrandedReelProps, type Scene } from './storyboard';

import { StoryStepper } from './scenes/StoryStepper';
import { Checklist } from './scenes/Checklist';
import { Stamp } from './scenes/Stamp';
import { DecisionCard } from './scenes/DecisionCard';
import { ChatBubble } from './scenes/ChatBubble';
import { StatHud } from './scenes/StatHud';
import { ImageInsert } from './scenes/ImageInsert';
import { VoiceBubble } from './scenes/VoiceBubble';
import { RelationCards } from './scenes/RelationCards';
import { StatChips } from './scenes/StatChips';
import { SectionEyebrow } from './scenes/SectionEyebrow';
import { PunchWord } from './scenes/PunchWord';

// Re-export the schema/props so Root.tsx and external callers keep importing
// them from './BrandedReel' after the dedupe into ./storyboard.
export { brandedReelSchema } from './storyboard';
export type { BrandedReelProps } from './storyboard';

// Cyrillic-safe family for the whole overlay. Captions load their own font.
loadFont();
const montserrat = loadMontserrat('normal', {
  weights: ['700', '900'],
  subsets: ['cyrillic', 'latin'],
});
export const BRAND_FONT_FAMILY = montserrat.fontFamily;

/* ---- split geometry (px, 1080x1920) ------------------------------------- */
const DIVIDER_Y = 864; // 45% graphics / 55% footage
const DIVIDER_H = 5;
const SCENE_BAND = { x: CANVAS.gutter, y: 300, width: CANVAS.width - CANVAS.gutter * 2, height: 520 };
const CAPTION_SWITCH_MS = 1200;

/** Scene types that take over the WHOLE frame instead of the top band. */
const FULL_BLEED: ReadonlySet<Scene['type']> = new Set<Scene['type']>(['PunchWord']);

/* ---- scene registry ----------------------------------------------------- */
export const SCENE_REGISTRY: Record<Scene['type'], React.ComponentType<any>> = {
  StoryStepper,
  Checklist,
  Stamp,
  DecisionCard,
  ChatBubble,
  StatHud,
  ImageInsert,
  VoiceBubble,
  RelationCards,
  StatChips,
  SectionEyebrow,
  PunchWord,
};

export const calculateBrandedReelMetadata: CalculateMetadataFunction<BrandedReelProps> = async (
  params,
) => {
  const raw = params.props.src;
  const resolved = /^(https?:)?\/\//.test(raw) || raw.startsWith('/') ? raw : staticFile(raw);
  const base = await calculateCaptionedVideoMetadata({
    ...params,
    props: { src: resolved },
  } as any);
  return { ...base, width: CANVAS.width, height: CANVAS.height };
};

/* ---- persistent HUD (topic + progress % + chapter stepper) -------------- */
const Hud: React.FC<{ theme: BrandTheme; font: string; topic: string; chapters: string[] }> = ({
  theme,
  font,
  topic,
  chapters,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const pct = Math.round(
    interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 100], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );
  const active = chapters.length
    ? Math.min(chapters.length - 1, Math.floor((pct / 100) * chapters.length))
    : -1;

  return (
    <div style={{ position: 'absolute', left: CANVAS.gutter, right: CANVAS.gutter, top: 56 }}>
      {/* topic + % */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontFamily: font,
            fontWeight: 900,
            fontSize: 30,
            letterSpacing: 3,
            color: theme.text,
            textTransform: 'uppercase',
          }}
        >
          <span style={{ color: theme.accent }}>— </span>
          {topic || 'РАЗБОР'}
        </span>
        <span
          style={{
            fontFamily: font,
            fontWeight: 700,
            fontSize: 28,
            color: theme.sub,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {String(pct).padStart(2, '0')}%
        </span>
      </div>

      {/* chapter stepper */}
      {chapters.length ? (
        <div style={{ position: 'relative', marginTop: 26, height: 40 }}>
          <div
            style={{
              position: 'absolute',
              top: 6,
              left: 0,
              right: 0,
              height: 3,
              background: theme.border,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 6,
              left: 0,
              width: `${(Math.max(0, active) / Math.max(1, chapters.length - 1)) * 100}%`,
              height: 3,
              background: theme.accent,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {chapters.map((c, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: i <= active ? theme.accent : theme.surface,
                    border: `2px solid ${i <= active ? theme.accent : theme.border}`,
                  }}
                />
                <span
                  style={{
                    marginTop: 8,
                    fontFamily: font,
                    fontWeight: i === active ? 900 : 700,
                    fontSize: 17,
                    letterSpacing: 0.5,
                    color: i === active ? theme.accent : theme.sub,
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

/* ---- captions (reused engine, repositioned over footage) ---------------- */
const Captions: React.FC<{ src: string }> = ({ src }) => {
  const [subtitles, setSubtitles] = useState<Caption[]>([]);
  const { delayRender, continueRender } = useDelayRender();
  const [handle] = useState(() => delayRender());
  const { fps } = useVideoConfig();
  const file = src.replace(/.mp4$/, '.json').replace(/.mov$/, '.json').replace(/.webm$/, '.json');

  const fetchSubs = useCallback(async () => {
    try {
      await loadFont();
      const exists = getStaticFiles().find((f) => f.src === file);
      if (!exists) {
        setSubtitles([]);
        continueRender(handle);
        return;
      }
      const res = await fetch(file);
      setSubtitles((await res.json()) as Caption[]);
      continueRender(handle);
    } catch (e) {
      cancelRender(e);
    }
  }, [continueRender, handle, file]);

  useEffect(() => {
    fetchSubs();
    const c = watchStaticFile(file, fetchSubs);
    return () => c.cancel();
  }, [fetchSubs, file]);

  const { pages } = useMemo(
    () => createTikTokStyleCaptions({ combineTokensWithinMilliseconds: CAPTION_SWITCH_MS, captions: subtitles ?? [] }),
    [subtitles],
  );

  return (
    <>
      {pages.map((page, i) => {
        const next = pages[i + 1] ?? null;
        const start = (page.startMs / 1000) * fps;
        const end = Math.min(next ? (next.startMs / 1000) * fps : Infinity, start + CAPTION_SWITCH_MS);
        const dur = end - start;
        if (dur <= 0) return null;
        return (
          <Sequence key={i} from={start} durationInFrames={dur}>
            <SubtitlePage page={page} />
          </Sequence>
        );
      })}
    </>
  );
};

/* ---- compositor --------------------------------------------------------- */
export const BrandedReel: React.FC<BrandedReelProps> = ({ src, theme, topic, chapters, scenes }) => {
  const { fps } = useVideoConfig();
  const th = resolveBrandTheme(theme);
  const footage = /^(https?:)?\/\//.test(src) || src.startsWith('/') ? src : staticFile(src);
  const msToFrame = (ms: number) => Math.round((ms / 1000) * fps);

  return (
    <AbsoluteFill style={{ backgroundColor: th.bg }}>
      {/* TOP ZONE background (theme.bg already painted by root fill) */}

      {/* FOOTAGE ZONE */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: DIVIDER_Y,
          width: CANVAS.width,
          height: CANVAS.height - DIVIDER_Y,
          overflow: 'hidden',
          backgroundColor: '#000',
        }}
      >
        <OffthreadVideo src={footage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>

      {/* red divider */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: DIVIDER_Y - DIVIDER_H / 2,
          width: CANVAS.width,
          height: DIVIDER_H,
          backgroundColor: th.accent,
        }}
      />

      {/* HUD */}
      <Hud theme={th} font={BRAND_FONT_FAMILY} topic={topic} chapters={chapters} />

      {/* SCENE band — one motion-graphic per beat; PunchWord takes over full frame */}
      {scenes.map((scene, i) => {
        const Comp = SCENE_REGISTRY[scene.type];
        if (!Comp) return null;
        const from = msToFrame(scene.fromMs);
        const durationInFrames = Math.max(1, msToFrame(scene.toMs - scene.fromMs));
        const common = { ...scene, theme: th, font: BRAND_FONT_FAMILY, topic, durationInFrames };
        const key = `${scene.type}-${scene.fromMs}-${i}`;
        if (FULL_BLEED.has(scene.type)) {
          return (
            <Sequence key={key} from={from} durationInFrames={durationInFrames} layout="none">
              <AbsoluteFill>
                <Comp {...common} />
              </AbsoluteFill>
            </Sequence>
          );
        }
        return (
          <Sequence key={key} from={from} durationInFrames={durationInFrames} layout="none">
            <div style={{ position: 'absolute', left: SCENE_BAND.x, top: SCENE_BAND.y, width: SCENE_BAND.width, height: SCENE_BAND.height }}>
              <Comp {...common} />
            </div>
          </Sequence>
        );
      })}

      {/* captions over footage */}
      <Captions src={footage} />
    </AbsoluteFill>
  );
};

/* ---- demo defaultProps -------------------------------------------------- */
export const brandedReelDefaultProps: BrandedReelProps = {
  src: 'sample-video.mp4',
  theme: 'razbor',
  topic: 'РАЗБОР · ИЗМЕНА',
  chapters: ['УНИВЕР', 'РАБОТА', 'КЛУБ', 'РАЗРЫВ', '2 ДНЯ', 'ПРОСТИЛ'],
  scenes: [
    { type: 'ChatBubble', fromMs: 200, toMs: 3000, text: 'сидит на парах и рассказывает это ВСЛУХ, при всех', author: 'однокурсница', typing: true, side: 'left' },
    { type: 'StoryStepper', fromMs: 3000, toMs: 6500, title: 'ХРОНОЛОГИЯ', steps: [{ label: 'УНИВЕР' }, { label: 'РАБОТА' }, { label: 'КЛУБ', caption: 'та самая ночь' }, { label: 'РАЗРЫВ' }, { label: 'ПРОСТИЛ' }], activeIndex: 2 },
    { type: 'Checklist', fromMs: 6500, toMs: 9200, title: 'ЧТО ВЫДАЁТ', items: [{ text: 'Телефон экраном вниз', status: 'bad' }, { text: 'Резко сменил пароль', status: 'bad' }, { text: 'Спокойно даёт телефон', status: 'good' }] },
    { type: 'Stamp', fromMs: 9200, toMs: 11200, text: 'РАССТАЮСЬ', sub: 'статус: разрыв', rotationDeg: -10, tone: 'accent' },
    { type: 'DecisionCard', fromMs: 11200, toMs: 14500, label: 'ВЕРДИКТ', verdict: 'Я ЕЁ ПРОСТИЛ', subtitle: 'казалось бы — всё', tone: 'accent' },
  ],
};

export default BrandedReel;
