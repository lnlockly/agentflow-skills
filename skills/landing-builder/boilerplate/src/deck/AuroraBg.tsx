// AuroraBg — animated gradient-mesh background (moving blurred blobs).
// The palette is NOT baked in — the deck passes `colors`/`base` per topic, so a
// solemn history deck looks nothing like a startup pitch. Pure CSS + framer-motion.
import { motion } from "framer-motion";

const blob = (color: string, dur: number, from: string, to: string, i: number) => (
  <motion.div
    key={i}
    className="absolute rounded-full blur-[90px]"
    style={{ width: "48vw", height: "48vw", background: color, mixBlendMode: "screen" }}
    initial={{ x: from.split(" ")[0], y: from.split(" ")[1], opacity: 0.5 }}
    animate={{ x: [from.split(" ")[0], to.split(" ")[0], from.split(" ")[0]], y: [from.split(" ")[1], to.split(" ")[1], from.split(" ")[1]] }}
    transition={{ duration: dur, repeat: Infinity, ease: "easeInOut" }}
  />
);

const PATHS: [string, string][] = [
  ["-10vw -10vh", "30vw 20vh"],
  ["60vw 50vh", "20vw -5vh"],
  ["40vw 60vh", "70vw 30vh"],
];

/**
 * @param colors  up to 3 blob colors — CHOOSE per topic (muted/ashen for solemn,
 *                vivid for a pitch). Empty/one color = calm, restrained motion.
 * @param base    the page base color the vignette fades into.
 */
export function AuroraBg({ colors, base = "#08080b" }: { colors: string[]; base?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ background: base }}>
      {colors.slice(0, 3).map((c, i) => blob(c, 18 + i * 4, PATHS[i][0], PATHS[i][1], i))}
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, transparent 30%, ${base} 85%)` }} />
    </div>
  );
}
