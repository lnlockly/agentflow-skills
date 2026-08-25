// Counter — animated count-up number (framer-motion). For metric/traction slides.
import { animate, useMotionValue, useTransform, motion } from "framer-motion";
import { useEffect } from "react";

export function Counter({ to, suffix = "", prefix = "", duration = 1.6 }: { to: number; suffix?: string; prefix?: string; duration?: number }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => prefix + Math.round(v).toLocaleString("ru-RU") + suffix);
  useEffect(() => {
    const controls = animate(mv, to, { duration, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [to, duration, mv]);
  return <motion.span>{text}</motion.span>;
}
