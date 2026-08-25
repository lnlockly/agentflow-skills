// Deck.tsx — an animated, keyboard-driven slide deck engine (framer-motion).
// The engine imposes NO look: colors come from a `theme` the agent chooses per
// topic (solemn history ≠ startup pitch). Slides are React nodes, so they have
// the full power of the landing components. The agent writes slides + theme in
// `slides.tsx` and renders <Deck slides={slides} theme={theme} /> from App.tsx.
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AuroraBg } from "./AuroraBg";

export interface DeckTheme {
  /** Page base color the whole deck sits on. */
  base?: string;
  /** Up to 3 aurora blob colors — CHOOSE for the topic. `[]` = calm, no glow. */
  aurora?: string[];
  /** Accent color — drives `text-primary` / progress bar. */
  accent?: string;
  /** Default text color. */
  fg?: string;
}

export interface DeckSlide {
  id: string;
  /** The slide content — full JSX, any landing component, threeui hero, etc. */
  node: React.ReactNode;
  /** Optional per-slide background (css color / gradient / `url(...)`). */
  bg?: string;
}

// Neutral graphite default — deliberately NOT branded. Override via `theme`.
const DEFAULT: Required<DeckTheme> = { base: "#0b0d10", aurora: ["#2a3340", "#1a2028"], accent: "#c8ccd2", fg: "#f3f4f6" };

function collectImages(slides: DeckSlide[]): string[] {
  const urls: string[] = [];
  for (const s of slides) {
    const m = s.bg?.match(/url\(["']?([^"')]+)["']?\)/);
    if (m) urls.push(m[1]);
  }
  return urls;
}

export function Deck({ slides, theme }: { slides: DeckSlide[]; theme?: DeckTheme }) {
  const t = { ...DEFAULT, ...theme, aurora: theme?.aurora ?? DEFAULT.aurora };
  const [[index, dir], setState] = useState<[number, number]>([0, 0]);
  const reduce = useReducedMotion();
  const count = slides.length;

  // Preload every slide background image up-front so photos appear instantly.
  const images = useMemo(() => collectImages(slides), [slides]);
  useEffect(() => {
    images.forEach((src) => { const img = new Image(); img.src = src; });
  }, [images]);

  const go = useCallback(
    (d: number) => setState(([i]) => {
      const next = Math.min(count - 1, Math.max(0, i + d));
      return [next, d];
    }),
    [count],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "ArrowDown", " ", "PageDown"].includes(e.key)) { e.preventDefault(); go(1); }
      else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); go(-1); }
      else if (e.key === "Home") setState([0, -1]);
      else if (e.key === "End") setState([count - 1, 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, count]);

  const slide = slides[index];
  const variants = {
    enter: (d: number) => ({ x: reduce ? 0 : d > 0 ? 120 : -120, opacity: 0, scale: reduce ? 1 : 0.94, filter: reduce ? "none" : "blur(8px)" }),
    center: { x: 0, opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: (d: number) => ({ x: reduce ? 0 : d > 0 ? -120 : 120, opacity: 0, scale: reduce ? 1 : 0.94, filter: reduce ? "none" : "blur(8px)" }),
  };

  return (
    <div
      className="relative h-screen w-screen overflow-hidden select-none"
      style={{ background: t.base, color: t.fg, ["--primary" as string]: t.accent }}
    >
      <AuroraBg colors={t.aurora} base={t.base} />
      <AnimatePresence mode="wait" custom={dir}>
        <motion.section
          key={slide.id}
          custom={dir}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: "spring", stiffness: 260, damping: 30, opacity: { duration: 0.25 } }}
          className="absolute inset-0 flex flex-col items-center justify-center bg-cover bg-center px-[8vw] text-center"
          style={slide.bg ? { background: slide.bg, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        >
          {slide.node}
        </motion.section>
      </AnimatePresence>

      {/* click zones for prev/next */}
      <button aria-label="prev" onClick={() => go(-1)} className="absolute left-0 top-0 h-full w-1/4 cursor-w-resize opacity-0" />
      <button aria-label="next" onClick={() => go(1)} className="absolute right-0 top-0 h-full w-3/4 cursor-e-resize opacity-0" />

      {/* progress bar */}
      <div className="absolute bottom-0 left-0 h-1 transition-all duration-300" style={{ width: `${((index + 1) / count) * 100}%`, background: t.accent }} />
      {/* counter */}
      <div className="absolute bottom-4 right-6 text-sm tabular-nums opacity-60">
        {index + 1} / {count}
      </div>
    </div>
  );
}
