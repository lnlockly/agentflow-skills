---
name: deck-studio
description: Discrete MCP tools that back the deck-builder agent — theme listing, image generation (gpt-image-2), stock search (Pexels), and Marp export to HTML+PDF+PPTX. The deck-builder SKILL orchestrates these; this is the toolbox, not the director.
---

# deck-studio (MCP toolbox)

Per-agent stdio MCP server. Tools (called as `mcp__deck__<tool>`):
- `list_themes` — bundled ready themes (themes/*.css) + Marp built-ins; the user
  can drop their own `<name>.css` into `themes/` and it appears here.
- `generate_image` — gpt-image-2 image for a slide (cover/section/illustration).
- `search_stock` — a real Pexels photo (needs `PEXELS_API_KEY`).
- `search_openverse` — a REAL image from the world's open libraries (Smithsonian, Europeana, Wikimedia, museums) via Openverse — FREE, broadest coverage, great for education/history.
- `build_deck` — Marp markdown → **HTML + PDF + PPTX** in one call.

A deck lives under `DECKS_ROOT` (default `/app/data/decks`) as `<deck>/deck.md`
+ `<deck>/assets/` + `<deck>/out/`. Research is the agent's own web tools — this
server holds no fixed pipeline; the deck-builder SKILL is the director.

Prereq: run `bash setup.sh` once (installs the MCP SDK + Marp CLI). Marp uses the
pod's Chromium (BROWSER_EXECUTABLE) for PDF/PPTX.
