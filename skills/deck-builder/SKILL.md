---
name: deck-builder
description: Create a genuinely high-quality presentation on any topic — researched, well-designed, illustrated — and deliver it as HTML + PDF + PPTX. Use whenever the user wants a presentation, slides, deck, doklad, or pitch.
---

# Deck Builder — «Сделай презентацию»

You produce a **premium, well-researched, beautifully designed** deck and deliver
it in **HTML, PDF and PPTX**. Quality is the whole point — real facts, a strong
narrative, disciplined design, and real/generated imagery. Not a wall of bullets.

The `deck-studio` MCP is your toolbox: `list_themes`, `generate_image`,
`search_stock`, `build_deck` (Marp → HTML+PDF+PPTX). You are the director.

## Flow (be a real designer — plan, research, then build)

1. **Understand.** Topic, audience, goal, length, language, tone. Recall the
   user's brand/preferred theme from memory. Ask at most one sharp question.
2. **RESEARCH with your own web tools.** Get real, accurate facts, figures, dates,
   names, quotes, and what the key visuals should be. Quality starts here — never
   invent numbers; cite where it matters. For sensitive/historical topics, be
   accurate and respectful.
3. **OUTLINE a narrative arc**, not a list: title → hook → 4–8 sections each making
   ONE point → a strong close. One idea per slide. Show the outline to the user to
   approve if the deck is big.
4. **Pick a theme** (`list_themes`) that fits the mood (e.g. `aurora` editorial,
   `dracula`/`rose-pine` dark, `academic` formal, `gradient` modern) — or the
   user's saved one. The user can add their own `<name>.css` to themes/.
5. **Author the deck as Marp markdown** in `<deckDir>/deck.md`:
   - Frontmatter: `marp: true`, `theme: <name>`, `paginate: true`, `size: 16:9`.
   - Slides separated by `---`. Per-slide layout via `<!-- _class: cover -->`
     (also: `section`, `quote`, `stat`, `twocol`, `invert` for dark).
   - Strong, concise copy. Big ideas, short lines. Real data in tables/`stat` slides.
   - Full-bleed image slides: `![bg](assets/x.png)` (add `![bg brightness:.5](..)`
     or use the `cover`/`invert` class for legible text over photos).
6. **Illustrate — SEARCH real images first, generate only when nothing real fits.**
   - `search_image` (Wikimedia Commons, real + public-domain + attribution) — **use
     FIRST** for real-world, historical, place, person, event, product topics. A
     real photo (e.g. a WWII archival image) must be REAL — never fabricate it.
   - `search_stock` (Pexels) — for generic modern business/lifestyle/nature photos.
   - `generate_image` (gpt-image-2) — ONLY for abstract/conceptual/branded visuals,
     diagrams-as-art, or when no real image exists. Cheaper to search than generate.
   Keep the attribution/license the search returns (add a small credit line).
   One strong image beats five icons. Reference by the returned `rel` path.
7. **BUILD** → `build_deck({deckDir, theme, name})` → HTML + PDF + PPTX.
8. **DELIVER** the three files to the user; optionally publish the HTML (publish
   skill) for a shareable link.

## Rules (quality bar)
- **Research real facts first.** No invented figures. Accurate + respectful on
  history/sensitive topics.
- **One idea per slide.** Ruthless editing. Headline + support, not paragraphs.
- **Design discipline** — consistent theme, real imagery, breathing room. A great
  deck looks intentional.
- **Ready themes + the user's own** — never hardcode one look; pick to fit, let the
  user swap/add a theme.
- **Remember** the user's brand, preferred theme, language — apply by default next time.
