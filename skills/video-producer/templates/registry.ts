/**
 * templates/registry.ts — MERGED VIDEO TEMPLATE REGISTRY (single source of truth)
 *
 * One coherent set of FORKABLE example presets for the proven BrandedReel render
 * (hub skill lnlockly/agentflow-skills/skills/video-producer). Split layout:
 * top ~45% theme.bg motion zone (persistent HUD + chapter stepper + ONE scene
 * per beat) · fixed red divider · bottom ~55% footage + karaoke captions.
 *
 * Each entry is an EXAMPLE / starting point (per how-to-build-agents canon),
 * NOT a rail. The user picks one, tweaks the tokens/scenes, or clones it.
 * The worked storyboard for each lives at `public/${exampleFile}` and is scene-
 * only (captions come from the VO/karaoke layer, not the storyboard).
 *
 * MERGE NOTES
 *  - 9 templates, unique ids: mem, citata, breaking, podcast-clip,
 *    tutorial-steps, facts-curious, storytelling, offer, listicle.
 *  - All DISTINCT from the 6 already-shipped presets (разбор/досье/красный/
 *    hype/rank/quote). Deliberate variants where a brief overlapped a shipped
 *    one: citata ≠ quote (gold-on-navy slow build vs coral static card),
 *    breaking ≠ hype (dark newsroom+ticker vs light one-shot banner),
 *    listicle ≠ rank (additive countdown of tips vs competitive leaderboard).
 *  - Every theme = 11 BrandTheme tokens, WCAG-checked (notes per entry),
 *    accentText is always the legible pair on `accent`, and the NO-sub-on-red
 *    rule holds (the red divider is structural; sub/text never sit on it, and
 *    breaking's red chyron carries only white accentText).
 *  - Fonts limited to the Cyrillic Montserrat / Oswald / Unbounded set.
 *  - Example storyboards validate against the shipped scene types; each names
 *    the NEW signature scene(s) it still needs in `newScenes` (FOLLOWUP — wire
 *    those into storyboard.ts zod union + index.tsx SCENE_REGISTRY separately).
 */

export type BrandTheme = {
  name: string;
  dark: boolean;
  bg: string; surface: string; surfaceAlt: string;
  text: string; sub: string; border: string;
  accent: string; accentText: string;
  highlight: string; highlightText: string;
  ok: string;
};

// Google Fonts, all with Cyrillic subsets.
export type FontPair = {
  display: 'Montserrat' | 'Oswald' | 'Unbounded';  // big scene words
  body: 'Montserrat' | 'Oswald';                    // captions / card copy
  numeric: 'Oswald' | 'Unbounded';                  // HUD, counters, prices
};

export type TemplateEntry = {
  name: string;
  theme: BrandTheme;
  fontPair: FontPair;
  styleNote: string;   // director note: when to use, tone, pacing, scenes
  exampleFile: string; // public/example-<id>.json
  newScenes: string[]; // NEW signature scene types this preset needs (followup)
};

export const TEMPLATES: Record<string, TemplateEntry> = {
  /* ── 1. Мем / Юмор — the only comedic look ───────────────────────────── */
  mem: {
    name: 'Мем / Юмор',
    theme: {
      name: 'mem', dark: false,
      bg: '#FFFDF5', surface: '#FFFFFF', surfaceAlt: '#F3E9FF',
      text: '#171207', sub: '#5C5442', border: '#EBDFC7',
      accent: '#7C3AED', accentText: '#FFFFFF',      // violet, NOT red — never fights the divider
      highlight: '#FFDA1F', highlightText: '#171207',
      ok: '#12A150',
    }, // WCAG: text/bg ~18:1, sub/bg ~7.3:1, accentText/accent ~5.7:1, hlText/hl ~15:1
    fontPair: { display: 'Unbounded', body: 'Montserrat', numeric: 'Oswald' },
    styleNote:
      'КОМЕДИЙНАЯ арка сетап → поворот → панч. Быстрый ритм (сцены 1.5–3 c), пауза для смеха ПЕРЕД панчем. ' +
      'Каждый смешной момент фиксируй ReactionPop (большое реакционное слово + эмодзи; чередуй tone accent/highlight). ' +
      'Завязку — через ChatBubble/VoiceBubble, абсурд-цифры — StatChips, финал — PunchWord (filled). ' +
      'Без досье-серьёзки. Акцент фиолетовый; красный только на разделителе.',
    exampleFile: 'example-mem.json',
    newScenes: ['ReactionPop'], // top-band overlay sticker word, squash-and-stretch, NOT full-bleed
  },

  /* ── 2. Мотивация / Цитата — cinematic, distinct from `quote` ────────── */
  citata: {
    name: 'Мотивация / Цитата',
    theme: {
      name: 'citata', dark: true,
      bg: '#0B1020', surface: '#121A2E', surfaceAlt: '#182238',
      text: '#F3F5FA', sub: '#A9B4C8', border: '#26324A',
      accent: '#E8B04B', accentText: '#1A1204',
      highlight: '#E8B04B', highlightText: '#1A1204',
      ok: '#34D399',
    }, // WCAG: text/bg ~16:1, sub/bg ~7.1:1, accentText/accent ~9:1 (AAA)
    fontPair: { display: 'Montserrat', body: 'Montserrat', numeric: 'Oswald' },
    styleNote:
      'Кинематографичная медленная мотивация. Ядро — full-bleed QuoteReveal: строка СОБИРАЕТСЯ слово за словом ' +
      'на медленном наезде (4–6 c на цитату), тихие кадры-паузы для голоса. Арка: тезис → разворот → призыв. ' +
      '1–2 QuoteReveal максимум, между ними короткий SectionEyebrow как глава; 1–2 слова в emphasis (золото). ' +
      'Финал — PunchWord (короткий глагол: НАЧНИ/ВСТАНЬ/ИДИ). Без юмора и тикеров. Отличие от `quote`: там ' +
      'горячий коралл и статичная карточка — здесь золото по сине-чёрному и медленная сборка.',
    exampleFile: 'example-citata.json',
    newScenes: ['QuoteReveal'], // FULL-BLEED — must ALSO be added to FULL_BLEED in index.tsx
  },

  /* ── 3. Новости / Breaking — dark newsroom, distinct from `hype` ─────── */
  breaking: {
    name: 'Новости / Breaking',
    theme: {
      name: 'breaking', dark: true,
      bg: '#0C0D10', surface: '#14161B', surfaceAlt: '#1C1F27',
      text: '#FFFFFF', sub: '#B9C0CC', border: '#2A2F3A',
      accent: '#E10600', accentText: '#FFFFFF',      // red chyron carries ONLY white accentText
      highlight: '#FFD400', highlightText: '#141414',
      ok: '#22C55E',
    }, // WCAG: text/bg ~20:1, sub/bg ~10:1, accentText/accent ~5.0:1, hlText/hl ~15:1
    fontPair: { display: 'Oswald', body: 'Montserrat', numeric: 'Oswald' },
    styleNote:
      'Срочный эфир 24/7. Открывай LiveTicker (тег СРОЧНО, хлёсткий заголовок, LIVE-пульс, часы, бегущая строка). ' +
      'Тон ТЕЛЕГРАФНЫЙ. Факты/цифры — StatHud; образ — ImageInsert (bw, kenBurns); вывод — DecisionCard (ИТОГ). ' +
      'Возвращай LiveTicker как «обновление» между блоками; кульминация — PunchWord (glitchOn). Без юмора и пауз, ' +
      'ритм рубленый. Красный только на чироне/акценте (белый текст), sub на красном НИКОГДА. Отличие от `hype`: ' +
      'там светлая студия и одноразовый баннер — здесь тёмный эфир с постоянной бегущей строкой.',
    exampleFile: 'example-breaking.json',
    newScenes: ['LiveTicker'], // chyron strip (top lower-third + bottom scroller), NOT full-bleed
  },

  /* ── 4. Подкаст-клип — talking-head cut, minimal top graphics ────────── */
  'podcast-clip': {
    name: 'Подкаст-клип',
    theme: {
      name: 'podcast-clip', dark: true,
      bg: '#14110F', surface: '#1F1B18', surfaceAlt: '#2A2420',
      text: '#F5EFE8', sub: '#B7AC9F', border: '#3A322C',
      accent: '#E8A33D', accentText: '#14110F',      // on-air amber
      highlight: '#F5B843', highlightText: '#14110F',
      ok: '#3DD68C',
    }, // WCAG: text/bg ~14:1, sub/bg ~6.7:1, accentText/accent ~8:1
    fontPair: { display: 'Oswald', body: 'Montserrat', numeric: 'Oswald' },
    styleNote:
      'Нарезка длинных разговоров/интервью в вертикаль. Тон спокойный, «взрослый». Графика МИНИМАЛЬНАЯ — работает ' +
      'лицо + сильные сабы; темп медленнее прочих (1 идея = 1 длинный бит). Держи персистентный SpeakerLower как ' +
      'HUD-подпись; вытаскивай ОДНУ сильную фразу в PullLine на пике; PunchWord максимум раз, на панчлайне. StatHud ' +
      'только под названную цифру. Открывай и закрывай именем спикера + тегом выпуска. Амбер — только на HUD/акценте.',
    exampleFile: 'example-podcast-clip.json',
    newScenes: ['SpeakerLower', 'PullLine'], // persistent lower-third HUD; calm pulled-quote (gentler than PunchWord)
  },

  /* ── 5. Туториал / Шаги — clean how-to with a filling progress rail ──── */
  'tutorial-steps': {
    name: 'Туториал / Шаги',
    theme: {
      name: 'tutorial-steps', dark: false,
      bg: '#F4F6F8', surface: '#FFFFFF', surfaceAlt: '#EAEEF2',
      text: '#14181D', sub: '#5A6470', border: '#D6DCE2',
      accent: '#2F6BFF', accentText: '#FFFFFF',
      highlight: '#2F6BFF', highlightText: '#FFFFFF',
      ok: '#1FA971',
    }, // WCAG: text/bg ~15:1, sub/bg ~4.9:1, accentText/accent ~4.9:1
    fontPair: { display: 'Oswald', body: 'Montserrat', numeric: 'Oswald' },
    styleNote:
      'How-to / «как сделать X за N шагов». Тон дружелюбно-экспертный, без хайпа. Темп ровный: каждый шаг = один бит ' +
      'примерно равной длины; HUD ProgressRail (шаг k/N) заполняется по мере роликов. Каркас: SectionEyebrow → ' +
      'Checklist «что понадобится» → серия StepCard (гигантский номер + глагол + одна строка) → Checklist-recap → ' +
      'Stamp «Готово» (ok). StoryStepper — если шаги ветвятся; StepCard — для чистой линейной 1→2→3. Одно действие ' +
      'на шаг, глагол в начале. Синий = только акцент/номер/прогресс.',
    exampleFile: 'example-tutorial-steps.json',
    newScenes: ['StepCard', 'ProgressRail'], // StepCard = big num+verb+line; ProgressRail = HUD step k/N element
  },

  /* ── 6. Факты / Интересное — did-you-know, curiosity-gap ─────────────── */
  'facts-curious': {
    name: 'Факты / Интересное',
    theme: {
      name: 'facts-curious', dark: true,
      bg: '#12132A', surface: '#1B1D3A', surfaceAlt: '#26294F',
      text: '#F2F3FF', sub: '#A5A8D0', border: '#33366A',
      accent: '#3DE0C8', accentText: '#06121F',
      highlight: '#FFD84D', highlightText: '#101014',
      ok: '#3DE0C8',
    }, // WCAG: text/bg ~15:1, sub/bg ~7:1, accentText/accent ~9:1
    fontPair: { display: 'Unbounded', body: 'Montserrat', numeric: 'Unbounded' },
    styleNote:
      'Did-you-know / тривия / листиклы «N фактов о X». Тон бодрый, удивляющий. Темп быстрый — каждый факт мини- ' +
      'клиффхэнгер (curiosity gap): открывай хуком (SectionEyebrow «А вы знали?» + PunchWord), разгадку давай на ' +
      'следующем бите. Рабочая лошадка — FactCard (гигантская цифра + строка контекста + source-тег); MythBuster ' +
      'для «миф → факт»; StatChips/StatHud для сравнений; Stamp «Факт ✔» как печать. HUD-степпер = счётчик (1/5…5/5). ' +
      'Жёлтый на цифрах, teal на «ага»-акцентах. Закрывай CTA «сохрани / удиви друзей».',
    exampleFile: 'example-facts-curious.json',
    newScenes: ['FactCard', 'MythBuster'], // giant stat+context+source; struck myth → teal reveal
  },

  /* ── 7. История — warm candlelit narrative arc ──────────────────────── */
  storytelling: {
    name: 'История',
    theme: {
      name: 'storytelling', dark: true,
      bg: '#17110E', surface: '#241A15', surfaceAlt: '#2F221B',
      text: '#F6ECE2', sub: '#C9B4A4', border: '#3D2C22',
      accent: '#F0A24E', accentText: '#2A1608',
      highlight: '#FFC978', highlightText: '#2A1608',
      ok: '#7FC98B',
    }, // WCAG: text/bg ~13:1, sub/bg ~6.4:1, accentText/accent ~7.8:1
    fontPair: { display: 'Montserrat', body: 'Montserrat', numeric: 'Oswald' },
    styleNote:
      'Личные/клиентские истории с аркой было → перелом → стало. Тон тёплый, честный, негромкий; паузы важнее слов, ' +
      'провал признаём открыто (это и есть крючок доверия). Темп самый медленный: 4 акта (завязка → провал → ' +
      'перелом → итог). Опора: VoiceBubble (голос героя), StoryStepper (арка во времени), DecisionCard (точка ' +
      'выбора), новый BeforeAfter (сам разворот, пик), Checklist (что изменили), StatHud (мягкий результат, не флекс). ' +
      'Финал тихий: фраза + мягкий CTA (PunchWord).',
    exampleFile: 'example-storytelling.json',
    newScenes: ['BeforeAfter'], // split-zone до/после: left dims to sub/surfaceAlt, right lights accent/ok
  },

  /* ── 8. Оффер — trust-navy direct sale, ends on price+CTA ───────────── */
  offer: {
    name: 'Оффер',
    theme: {
      name: 'offer', dark: true,
      bg: '#0C1826', surface: '#14263A', surfaceAlt: '#1B3049',
      text: '#F2F6FA', sub: '#A9BED2', border: '#23405C',
      accent: '#2F80ED', accentText: '#FFFFFF',       // azure = emphasis…
      highlight: '#FFD24D', highlightText: '#22303F',
      ok: '#22C67B',                                  // …ok green = CTA/checks (never collide)
    }, // WCAG: text/bg ~15:1, sub/bg ~7.2:1, hlText/hl ~10:1
    fontPair: { display: 'Oswald', body: 'Montserrat', numeric: 'Oswald' },
    styleNote:
      'Прямая продажа: боль → решение → выгоды → оффер+CTA. Тон уверенный и конкретный, без визга; доверие строим ' +
      'доказательством (цифры, гарантия, живой отзыв). Быстрый вход (крючок-боль в первые 3 c), ровный разгон по ' +
      'выгодам (ChatBubble/RelationCards/Checklist/StatChips), гарантия — Stamp (ok). Кульминация — новый OfferCard ' +
      '(цена крупно + зачёркнутый якорь в sub + CTA-кнопка на ok + микро-строка доверия). Закрытие — VoiceBubble ' +
      '(соц-док) + повторный PunchWord CTA. Пауза на цифре и на кнопке. Accent (azure) и ok (green) — разные роли.',
    exampleFile: 'example-offer.json',
    newScenes: ['OfferCard'], // plan+price+anchor(sub, strike)+CTA button(ok)+trust line; optional discount badge on accent
  },

  /* ── 9. Топ-факты — light editorial countdown, distinct from `rank` ──── */
  listicle: {
    name: 'Топ-факты',
    theme: {
      name: 'listicle', dark: false,
      bg: '#F3F5F8', surface: '#FFFFFF', surfaceAlt: '#E9EDF3',
      text: '#12151B', sub: '#55606E', border: '#D3DAE3',
      accent: '#5B4CFF', accentText: '#FFFFFF',
      highlight: '#FFE24A', highlightText: '#12151B',
      ok: '#17A672',                                  // green #1 payoff
    }, // WCAG: text/bg ~16:1, sub/bg ~5.6:1, hlText/hl ~12:1
    fontPair: { display: 'Unbounded', body: 'Montserrat', numeric: 'Unbounded' },
    styleNote:
      'Списочный контент с обратным отсчётом: «7 приёмов», «5 ошибок». Обучающий «сохрани себе» формат — НЕ рейтинг- ' +
      'соревнование (для этого есть `rank`), здесь пункты не борются, а копятся. Тон бодрый, редакторский, коротко. ' +
      'Равномерный «тик»: один CountItem на пункт одинаковой длины, лёгкое ускорение к #1 с паузой и ok-зелёной ' +
      'подсветкой (кульминация). Обрамление: SectionEyebrow (обещание числа) → PunchWord (старт отсчёта) → CountItem×N ' +
      '→ StatHud (итог) → PunchWord (сохрани). HUD-степпер = прогресс отсчёта.',
    exampleFile: 'example-listicle.json',
    newScenes: ['CountItem'], // giant descending number on accent; at n===1 badge/emphasis auto-switch accent→ok
  },
};

/** All NEW signature scenes to wire up as a FOLLOWUP (dedup across the set). */
export const NEW_SIGNATURE_SCENES = [
  'ReactionPop',   // mem            — top-band sticker word (squash/stretch), NOT full-bleed
  'QuoteReveal',   // citata         — FULL-BLEED word-by-word build (add to FULL_BLEED)
  'LiveTicker',    // breaking       — chyron strip (top lower-third + bottom scroller)
  'SpeakerLower',  // podcast-clip   — persistent name/role/show lower-third (HUD)
  'PullLine',      // podcast-clip   — calm pulled quote with « » ticks
  'StepCard',      // tutorial-steps — big number + verb + one line
  'ProgressRail',  // tutorial-steps — HUD element: step k/N, fills over beats
  'FactCard',      // facts-curious  — giant stat + context + source tag
  'MythBuster',    // facts-curious  — struck-through myth → teal reveal
  'BeforeAfter',   // storytelling   — split-zone до/после contrast (the story turn)
  'OfferCard',     // offer          — plan+price+anchor+CTA button+trust line
  'CountItem',     // listicle       — giant descending number (n===1 → ok-green payoff)
] as const;

export const TEMPLATE_IDS = Object.keys(TEMPLATES);
export default TEMPLATES;
