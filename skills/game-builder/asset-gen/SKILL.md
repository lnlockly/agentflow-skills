---
name: asset-gen
description: Get game art — textures, 3D models (GLB), sprites, backgrounds — for a Babylon.js game. FREE CC0/permissive hubs first (search + download with licence recorded), generation only for what's missing or must be specific. Use whenever a game needs visual assets.
---

# Game assets — free first, generate second

A game needs textures, models, sprites, backgrounds. **Always try the free hubs
before you generate** — it's free, instant, and consistent. Generate only the
things that must match a specific look the hubs don't have. Every asset (free or
generated) goes in the **README asset table** with its **licence** and **in-game
size**, or coders scale and credit it wrong.

## 1. FREE hubs first — `tools/asset_search.py`
```bash
# CC0 PBR textures (ambientCG — no key, works out of the box)
python3 tools/asset_search.py texture --query "wood floor" --download -o src/assets/tex
# low-poly 3D models (Poly Pizza — free key: set POLY_PIZZA_KEY, get it at poly.pizza/api)
python3 tools/asset_search.py model --query "car" --download -o src/assets/glb
```
Prints JSON with `license` + `attribution` per hit; `--download` fetches (textures
arrive as a full PBR set: Color/Normal/Roughness/AO). **Record the licence** in the
README table; for CC-BY keep the attribution string.

Curated CC0 packs with no search API — pull specific packs by URL when you want a
consistent set:
- **Kenney** (kenney.nl/assets) — CC0 sprite kits, 3D, UI, audio. Best for a coherent
  look across a whole game. No attribution required.
- **Quaternius** (quaternius.com) — CC0 low-poly 3D packs (characters, nature, weapons).
- **OpenGameArt** (opengameart.org) — huge, MIXED licences → filter CC0/CC-BY and
  record attribution. Good for one-off sprites/tilesets/audio.

## 2. Generate only what's missing — your native image tool
For a specific hero sprite, logo, or background the hubs don't have, use your
**built-in image generation** (gpt-image via the gateway) — it's a paid call, so
**confirm the spend with the user before the first generation**. Save under
`src/assets/`. Design display sizes ≥128px (small icons downscale muddy); or generate
a kit (several objects in one image) and slice it:
```bash
python3 tools/grid_slice.py kit.png --grid 2x2 --names "sword,shield,potion,coin" -o src/assets/items
```

### Transparency (sprites)
Read `rembg.md`. Key rule: **never prompt for a "transparent background"** (the model
bakes a checkerboard) — prompt a solid colour, then matte it out:
```bash
python3 tools/rembg_matting.py --batch frames/ -o clean/
```

### Animated sprites (optional)
reference → pose → short video → extract frames → loop-trim → matte. `find_loop_frame.py
frames/` returns the loop frame for walk/idle cycles (delete frames past it); skip for
one-shots. Drive playback off elapsed time (~1/24s), restart a loop only on state change.

### Custom 3D (optional, paid)
Free Poly Pizza / Quaternius cover most needs. For a bespoke model, image→GLB via
Tripo3D needs `TRIPO3D_API_KEY` (not shipped by default — ask the owner). A static GLB
is ~30¢; confirm before spending.

## Pitfalls
- Generators have weak spatial sense — verify orientation from a screenshot; generate
  one facing direction and flip horizontally at runtime rather than paying for the mirror.
- Downscale mixed sources to the smallest before matting.

## Asset table (in README.md)
Track every asset with **licence** + **in-game Size** (models in metres, textures tile
size, sprites display px). Without size, coders scale wrong; without licence, you can't ship.

| Name | Description | Size | Licence | Path | Source/Cost |
|------|-------------|------|---------|------|-------------|
| grass | ground material | 2m tile | CC0 | src/assets/tex/Grass005 | ambientCG (free) |
| hero | player sprite | 128px | generated | src/assets/hero.png | gpt-image 5¢ |
