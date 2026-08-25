---
name: landing-builder
description: Build a polished landing page by COMPOSING ready-made components from registries (threeui 3D/shader heroes, shadcn/ui, 21st.dev), brand it, and publish it to a public URL. Use whenever the user wants a landing / promo / sales page.
---

# Строитель лендингов

You build a beautiful landing by **reusing ready-made components** — you don't
hand-code UI, you pull proven blocks from registries and assemble + brand them.

A ready scaffold (Vite + React + Tailwind + shadcn, already `npm install`-ed) is
pre-installed at **`/app/data/landing-studio`**.

## Autonomy (важно)
The user only describes their product ("сделай лендинг для кофейни, хочу ссылку").
YOU do the ENTIRE flow yourself, end to end, in one go — you don't ask the user
for commands, paths, or steps, and you don't stop halfway. You ALWAYS finish by
**publishing the site and returning the public https link** — a landing without a
live link is not done. The only thing you may pause for is the structure approval
in step 2 (and even that you can skip if the user said "just do it / хочу ссылку").

## Flow (be DYNAMIC — plan first)
1. **Understand + recall** the user's product, audience, goal, brand (from memory).
2. **Show the STRUCTURE first** — propose the section list (hero → выгоды → как
   работает → цены → отзывы → FAQ → CTA) and get approval BEFORE building.
3. **Scaffold a copy:**
   ```bash
   cp -r /app/data/landing-studio /app/data/landings/<name> && cd /app/data/landings/<name>
   ```
4. **Compose from READY blocks** — for each section pull a component:
   ```bash
   npx shadcn@latest add "<registry-url>" --yes
   ```
   Sources (see the skill's `sources.md`): **threeui** 3D/shader heroes
   (`https://threeui.com/r/<c>.json`), **shadcn/ui** primitives, **21st.dev** &
   **shadcnblocks** marketing blocks. Import into `src/sections/` + compose in
   `src/App.tsx`.
5. **Brand it** — edit design tokens in `src/index.css` (`--primary` = brand
   color, radius), write real copy, generate images with your image tool, add a
   threeui hero. Keep `npm run build` green.
6. **Preview** — `npm run build`, then `npm run preview` (serves on :4173).
7. **Publish (ALWAYS — this is the deliverable).** Expose the built `dist/` at a
   public https URL and give the user the link:
   ```bash
   python3 /opt/hermes-agent/publish.py serve /app/data/landings/<name>/dist <name>
   ```
   It prints `https://…sslip.io/`. Return THAT link to the user as the result.
   Never stop at a local build — the user wants a link they can open.

## Presentation mode (animated HTML decks — same stack, with motion)
When the user wants a PRESENTATION / slide deck (not a web page), build an
**animated deck** on this same stack (framer-motion). The engine is pre-installed:
- `src/deck/Deck.tsx` — engine: keyboard nav (←/→/space), spring/blur transitions,
  animated aurora background, progress bar. You don't edit this.
- `src/deck/slides.tsx` — YOU write the slides here as JSX (one idea per slide,
  `motion` reveals). An AgentFlow-pitch example is already there — replace it.
- `src/deck/Counter.tsx` (count-up numbers) + `src/deck/AuroraBg.tsx`.

To make a deck:
1. **Research** the topic for REAL facts/dates/figures. **Plan** the slide outline
   and show it first (skip if the user said "просто сделай").
2. **Real images** — for historical/factual/serious topics a photo must be REAL,
   never generated. Search them, and use ENOUGH of them (aim for a photo on most
   content slides — not 1–2 for the whole deck):
   ```bash
   node img-search.mjs "<query>" 6        # Openverse: FREE, world libraries (Wikimedia, Smithsonian, Europeana, museums) + attribution
   ```
   Download the chosen `url` and **downscale it** so it loads fast (archival
   scans are often 3–5 MB) — keep each under ~600 KB / ~1600px wide:
   ```bash
   curl -sL "<url>" -o /tmp/x && npx --yes sharp-cli -i /tmp/x -o public/<name>.jpg resize 1600 --withoutEnlargement -q 82
   # (no sharp? curl -L "<url>" -o public/<name>.jpg — but then keep the deck to a few images)
   ```
   Reference it as a slide `bg: "url(/<name>.jpg)"` (Deck preloads all bg images,
   so photos appear instantly) or an `<img>`; keep `attribution` in a small footnote.
3. **CHOOSE the theme — do NOT ship a fixed look.** Export a `theme` from
   `slides.tsx`; the engine has NO baked colors. Pick the palette FOR THE TOPIC:
   - solemn/history/war/science → ashen, desaturated, `aurora: []` or muted, e.g.
     `export const theme = { base:"#0d0b09", aurora:["#3a2f22","#241c14"], accent:"#b9a37a" }`
   - pitch/product/event → vivid + energetic (bright accent, 3 aurora colors).
   Never leave the AgentFlow-red pitch theme on a serious deck.
4. **Write `src/deck/slides.tsx`** — each slide `{ id, node: <JSX>, bg? }`. Use
   image-background slides (`bg: "url(/photo.jpg)"` + a dark scrim `<div>` over it
   for legible text), `<Counter>` for stats, staggered `motion` reveals.
5. **Point the app at the deck:** set `src/App.tsx` to
   `import { Deck } from "@/deck/Deck"; import { slides, theme } from "@/deck/slides"; export default function App(){ return <Deck slides={slides} theme={theme} />; }`
6. `npm run build` → **publish** (step 7) → return the link. Same as landings.

## Rules
- Show the structure/plan first — never silently build the whole page.
- Reuse ready components over hand-writing UI — that's the superpower.
- Brand via the design tokens in `src/index.css` (one place).
- Keep the build green after every block. Review pulled 3rd-party components.

## Remember the user
Save the user's brand (colors/fonts/tone), favourite blocks, and past landings to
memory — reuse them by default next time.
