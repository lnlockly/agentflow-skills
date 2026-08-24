---
name: landing-builder
description: Build a polished landing page for the user by COMPOSING ready-made components from registries (threeui 3D/shader heroes, shadcn/ui, 21st.dev), then brand it and publish it to a public URL. Use whenever the user wants a landing page, promo page, sales page, or a page for an ad campaign.
---

# Строитель лендингов

You build the user a beautiful landing page by **reusing ready-made components**
— you don't hand-code UI, you pull proven blocks from registries and assemble +
brand them. A ready scaffold ships with this skill at **`boilerplate/`** (Vite +
React + Tailwind + shadcn — the base every registry targets).

## When to use
The user wants a landing / promo / sales page (for a product, course, service, ad).

## The flow (be DYNAMIC — plan first, don't just build)

1. **Understand + recall.** Ask what's promoted, for whom, the goal, the vibe.
   Recall the user's brand/style from memory and default to it.
2. **Show the STRUCTURE first.** Propose the section list (hero → выгоды → как
   работает → цены → отзывы → FAQ → CTA) as a short plan / wireframe, and get the
   user to approve/tweak BEFORE assembling. This is the plan step.
3. **Scaffold.** Copy `boilerplate/` to a folder (e.g. `/app/data/landings/<name>`),
   `npm install`.
4. **Compose from READY blocks.** For each section pick a ready component and pull it:
   ```bash
   npx shadcn@latest add "<registry-url>" --yes
   ```
   Sources (see `sources.md`): **threeui** (3D/shader wow-heroes+backgrounds),
   **shadcn/ui** (primitives), **21st.dev** & **shadcnblocks** (marketing blocks).
   Import the pulled component into a section under `src/sections/` and compose in
   `src/App.tsx`. Reorder/add sections freely — it's just code.
5. **Brand it.** Edit the design tokens in `src/index.css` (`--primary` = brand
   color, radius, etc.), write the real copy yourself, generate images with your
   native image tool (gpt-image-2), and add a threeui hero for wow-factor.
6. **Preview + iterate.** `npm run build` must stay green; `npm run preview` to view.
7. **Publish.** Use the `publish` skill (frp tunnel) to expose the built site at a
   public https URL. Give the user the link.

## Rules (the canon)
- **Show the structure/plan first** — never silently build the whole page.
- **Reuse ready components** (registries) over hand-writing UI — that's the superpower.
- **Brand via the design tokens** in `src/index.css` (one place), not scattered hex.
- Keep `npm run build` green after every block you add.
- Always **review a pulled component** before shipping (community registries are 3rd-party).

## Registries (pluggable — add more anytime)
See `sources.md`. Adding a new source = adding a registry URL; the `shadcn add`
mechanism is the same for all. threeui is MIT and agent-friendly (each component
page offers a copy-prompt).

## Remember the user
Save the user's brand (colors, fonts, logo, tone), favourite sections/blocks, and
past landings to memory — and reuse them by default next time.
