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
   Use the native **`image_search` tool** — it searches Openverse (FREE: Wikimedia,
   Smithsonian, Europeana, museums) / Unsplash AND downloads only VALID images to
   disk (verifies Content-Type; skips broken HTML/hotlink pages), returning local
   paths + attribution:
   `image_search({ query: "<query>", count: 6 })` → `{ images:[{ path, attribution }] }`.
   Take each `path` and **downscale it** into `public/` so it loads fast (archival
   scans are often 3–5 MB) — keep each under ~600 KB / ~1600px wide:
   ```bash
   npx --yes sharp-cli -i "<path>" -o public/<name>.jpg resize 1600 --withoutEnlargement -q 82
   # (no sharp? cp "<path>" public/<name>.jpg — but then keep the deck to a few images)
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

## Reference-driven mode (build from a picture or a site — «как вот это»)
The strongest way to hit a look the user loves: they give a REFERENCE — a
screenshot / Pinterest image, or a URL — and you recreate that art direction on
our stack for THEIR product. This works for landings AND decks. Your hands:
`vision` (see an image), `browser` (open a URL + screenshot it), `image_gen`
(make matching hero art), `image_search` (real photos — downloaded + verified). Flow:

1. **SEE it — and for a URL, MEASURE it (this is proper cloning, not guessing).**
   - Image reference → analyse it with your **vision** tool.
   - URL reference → open it in the **browser**, scroll + screenshot the full page
     for the vision read, THEN extract the real **design tokens** by running JS in
     the page — don't eyeball colors from a screenshot when you can read the truth:
     ```js
     // in the browser tool, evaluate on the loaded page:
     const g = (el,p) => getComputedStyle(el)[p];
     ({ bodyBg:g(document.body,'backgroundColor'),
        bodyColor:g(document.body,'color'),
        font:g(document.body,'fontFamily'),
        h1:(h=>h&&({size:g(h,'fontSize'),weight:g(h,'fontWeight'),color:g(h,'color')}))(document.querySelector('h1')),
        radii:[...document.querySelectorAll('*')].map(e=>g(e,'borderRadius')).filter(r=>r!=='0px').slice(0,8),
        imgs:[...document.images].map(i=>i.currentSrc).slice(0,12) })
     ```
     Use the returned exact hex/rgb, font family, sizes, radii as your tokens. Pull
     the real hero/section images from `imgs` (download them into `public/`) when
     recreating that same site; swap brand logos + copy for the user's own product.
2. **Write a DESIGN BRIEF** and show it as the plan (this replaces the plain
   section list). Extract, concretely:
   - **Sections** top→bottom (the layout rhythm).
   - **Palette** as exact hex — background, text, accent, glow.
   - **Typography** — scale + weight (e.g. huge light display heading, small caps labels).
   - **Mood** — one line (e.g. "cinematic underwater, dark, glowing").
   - **Signature elements** — the things that MAKE the look (full-bleed photo hero,
     glassmorphism cards, numbered rule cards 01/02/03, avatar row, scroll cue).
   - **Motion** — reveals, parallax, drift.
3. **Source the art to match the vibe** — THIS is what makes it «крутецкое». A
   reference like this lives on its cinematic PHOTO/ART hero. **A real image is
   mandatory — never ship a flat CSS-gradient hero for a photographic reference.**
   In priority order:
   - **Generate** it with your native **`image_generate`** tool (gpt-image-2 via the
     gateway — it WORKS; just call it, don't infer availability from any tool
     catalog). Prompt from the brief (subject + "cinematic, volumetric god-rays,
     dark, high-detail, full-bleed"). One art direction across all sections.
   - **Real photo instead / as fallback → `image_search`** with
     `image_search({ query: "<vibe query>", count: 8 })` (e.g. "deep ocean god rays
     jellyfish dark") and use the best full-bleed shot. Real photo beats a CSS
     gradient every time — always take this over settling for gradients.
   - Realistic subject (product, food, city) → `image_search` real photos directly.
   Copy the chosen `image.path` into `public/` and reference it as the hero `bg`.
4. **Recreate the STRUCTURE + VIBE on-stack** — don't pixel-rip; rebuild the feeling
   with real components, and write the user's OWN copy. Set the brief's palette in
   `src/index.css` tokens. Concrete recipes for this class of look:
   - **Full-bleed hero**: `min-h-screen` section, the generated image as
     `bg-cover bg-center`, a dark scrim (`bg-black/40`) + a bottom gradient, huge
     heading (`text-7xl md:text-8xl font-light tracking-tight`) with a colored word.
   - **Glassmorphism card**: `rounded-3xl border border-white/15 bg-white/5
     backdrop-blur-md shadow-2xl` (the frosted panels + numbered cards).
   - **Numbered rule cards**: big `01 / 02 / 03` in a light weight over the glass.
   - **Team row**: circular avatars + name + role, subtle enter/hover.
   - **Motion**: framer-motion reveals on scroll, a slow parallax/drift on the hero.
5. Build → **publish** → return the link (as always).

Worked example — reading the "Blue Ocean" reference into a brief: sections =
hero → 3 numbered rules (glass) → "A SPACE" feature → 3 category cards (Sharks/
Fish/Whales, glass) → team (3 avatars) → CTA; palette bg `#05070d`, text `#eef4ff`,
accent glow `#2fa4ff`; type = giant light display + tiny uppercase labels; mood =
"deep cinematic ocean, god-rays, bioluminescent glow"; signatures = full-bleed
generated underwater hero, glass panels, numbered cards, avatar row; motion =
soft rise + hero drift. Then build THAT structure for the user's product, with a
freshly generated on-brand hero.

It's INSPIRATION, not theft: match layout/palette/type/mood; the reference sets the
art direction, the user's product sets the content and copy.

**🔴 NEVER FABRICATE A REFERENCE.** If you cannot actually SEE the reference — the
browser tool won't open the URL, the screenshot fails, the image won't load, the
page won't scrape — then STOP and tell the user plainly ("не смог открыть референс
— браузер не поднялся"). Do NOT invent a design, and do NOT reuse content from a
DIFFERENT landing you built earlier (a coding-school URL must never come out as an
ocean page). A published page that isn't the requested reference is a FALSE result,
worse than an honest failure. Only build from a reference you genuinely loaded.

## Rules
- Show the structure/plan first — never silently build the whole page.
- Reuse ready components over hand-writing UI — that's the superpower.
- Brand via the design tokens in `src/index.css` (one place).
- Keep the build green after every block. Review pulled 3rd-party components.

## Remember the user
Save the user's brand (colors/fonts/tone), favourite blocks, and past landings to
memory — reuse them by default next time.
