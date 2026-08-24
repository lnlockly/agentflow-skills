// Cyrillic-capable caption face. Swaps template-tiktok's Latin-only
// theboldfont.ttf for Montserrat Black (900) via @remotion/google-fonts,
// which loads cyrillic + latin subsets. Interface (TheBoldFont + loadFont)
// is preserved so Page.tsx / index.tsx need no change.
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";

const montserrat = loadMontserrat("normal", {
  weights: ["900"],
  subsets: ["cyrillic", "latin"],
});

export const TheBoldFont = montserrat.fontFamily;

export const loadFont = async (): Promise<void> => {
  await montserrat.waitUntilDone();
};
