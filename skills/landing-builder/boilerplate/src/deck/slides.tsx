// slides.tsx — the deck content. Each slide is full JSX on the landing stack:
// Tailwind + shadcn + threeui heroes + framer-motion. The agent REWRITES this
// per presentation. This example = an AgentFlow pitch, to show the motion style.
import { motion } from "framer-motion";
import { Rocket, Zap, Boxes, LineChart } from "lucide-react";
import { Counter } from "./Counter";
import type { DeckSlide, DeckTheme } from "./Deck";

// THEME — chosen for THIS deck, not baked into the engine. This is a startup
// pitch, so it's vivid + red. A solemn/history deck would pick an ashen palette
// (e.g. base "#0d0b09", aurora ["#3a2f22","#241c14"], accent "#b9a37a") or aurora [].
export const theme: DeckTheme = {
  base: "#08080b",
  aurora: ["#E0202C", "#7a0f16", "#2b0a0e"],
  accent: "#E0202C",
};

const rise = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: 0.12 * i, type: "spring", stiffness: 300, damping: 26 } }),
};

const Title = ({ children }: { children: React.ReactNode }) => (
  <motion.h1 variants={rise} initial="hidden" animate="show" className="text-6xl font-extrabold tracking-tight md:text-7xl">
    {children}
  </motion.h1>
);


export const slides: DeckSlide[] = [
  {
    id: "cover",
    node: (
      <div className="flex flex-col items-center gap-6">
        <motion.div variants={rise} initial="hidden" animate="show" className="rounded-full border border-primary/40 px-5 py-1 text-sm uppercase tracking-[0.3em] text-primary">
          AgentFlow
        </motion.div>
        <Title>ИИ-сотрудники<br />прямо в <span className="text-primary">Telegram</span></Title>
        <motion.p custom={1} variants={rise} initial="hidden" animate="show" className="max-w-xl text-xl text-white/70">
          Готовые агенты. Взял → работает. Без кода.
        </motion.p>
      </div>
    ),
  },
  {
    id: "problem",
    node: (
      <div className="flex max-w-3xl flex-col gap-8">
        <Title>Проблема</Title>
        <div className="grid gap-4 text-left text-2xl text-white/80">
          {["Нет технарей — не соберёшь агента сам", "Дорого и долго — разработка на заказ", "Зоопарк подписок вместо одного сотрудника"].map((t, i) => (
            <motion.div key={t} custom={i + 1} variants={rise} initial="hidden" animate="show" className="flex items-center gap-4">
              <span className="text-primary">✗</span> {t}
            </motion.div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "solution",
    node: (
      <div className="flex max-w-3xl flex-col gap-8">
        <Title>Решение</Title>
        <motion.p custom={1} variants={rise} initial="hidden" animate="show" className="text-2xl text-white/80">
          Магазин готовых ИИ-агентов. Выбрал → привязал бота → <span className="text-primary">работает за тебя.</span>
        </motion.p>
        <div className="grid grid-cols-2 gap-4 text-left md:grid-cols-4">
          {[["🎬", "Ролики"], ["🎨", "Лендинги"], ["🖼️", "Презы"], ["🤖", "Боты"]].map(([e, t], i) => (
            <motion.div key={t} custom={i + 2} variants={rise} initial="hidden" animate="show" className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
              <div className="mb-2 text-4xl">{e}</div><div className="text-white/80">{t}</div>
            </motion.div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "how",
    node: (
      <div className="flex max-w-4xl flex-col gap-10">
        <Title>Как это работает</Title>
        <div className="grid grid-cols-3 gap-6 text-left">
          {[[Boxes, "Выбери", "агента из витрины"], [Zap, "Привяжи", "своего бота — пара кликов"], [Rocket, "Работай", "пиши по-человечески"]].map(([Icon, h, s], i) => (
            <motion.div key={h as string} custom={i + 1} variants={rise} initial="hidden" animate="show" className="rounded-2xl border border-white/10 bg-white/5 p-8">
              <Icon className="mb-4 h-10 w-10 text-primary" />
              <div className="text-2xl font-semibold">{h as string}</div>
              <div className="mt-1 text-white/60">{s as string}</div>
            </motion.div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "traction",
    node: (
      <div className="flex max-w-3xl flex-col gap-8">
        <Title>Уже работает</Title>
        <motion.p custom={1} variants={rise} initial="hidden" animate="show" className="text-xl text-white/70">Агенты сами собрали и опубликовали:</motion.p>
        <div className="grid gap-3 text-left text-xl">
          {["📚 Лендинг книжного", "☕ Лендинг кофейни", "🏋️ Лендинг фитнес-курса"].map((t, i) => (
            <motion.div key={t} custom={i + 2} variants={rise} initial="hidden" animate="show" className="rounded-xl border border-white/10 bg-white/5 px-6 py-4">{t} — <span className="text-primary">по ссылке, автономно</span></motion.div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "metrics",
    node: (
      <div className="flex max-w-4xl flex-col gap-10">
        <Title>Цифры</Title>
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {[
            { to: 4, suf: "", label: "живых шаблона" },
            { to: 900, suf: "М+", label: "в Telegram" },
            { to: 60, suf: "с", label: "рендер ролика" },
            { to: 3, suf: "", label: "лендинга автономно" },
          ].map((m, i) => (
            <motion.div key={m.label} custom={i + 1} variants={rise} initial="hidden" animate="show" className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="text-5xl font-extrabold text-primary"><Counter to={m.to} suffix={m.suf} /></div>
              <div className="mt-2 text-white/60">{m.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "market",
    node: (
      <div className="flex max-w-3xl flex-col items-center gap-6">
        <LineChart className="h-14 w-14 text-primary" />
        <Title>Рынок</Title>
        <motion.p custom={1} variants={rise} initial="hidden" animate="show" className="text-2xl text-white/80">
          Малый бизнес + блогеры. Telegram — <span className="text-primary">900М+</span> и соцсеть №1 для бизнеса в СНГ.
        </motion.p>
      </div>
    ),
  },
  {
    id: "cta", bg: "linear-gradient(160deg,#E0202C 0%,#7a0f16 100%)",
    node: (
      <div className="flex flex-col items-center gap-6 text-white">
        <Title>Давай покажем демо</Title>
        <motion.p custom={1} variants={rise} initial="hidden" animate="show" className="text-2xl opacity-90">@AgentFlowTeam</motion.p>
      </div>
    ),
  },
];
