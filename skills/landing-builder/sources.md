# Component sources (registries)

The superpower: compose landings from READY components. Every source below is a
**shadcn registry** — pull any block with the SAME command:
```bash
npx shadcn@latest add "<url>" --yes
```
Adding a NEW source later = just adding a URL here. Always review pulled code
(community registries are third-party).

| Source | What | How | License |
|---|---|---|---|
| **threeui** | 3D / shader **wow-heroes**, animated backgrounds, motion buttons | `npx shadcn add "https://threeui.com/r/<component>.json"` — or npm `@designcodeio/threeui`. Each component page has a "copy prompt for your agent". | MIT (community edition) |
| **shadcn/ui** | Base primitives (button, card, dialog, tabs, accordion…) | `npx shadcn@latest add <name> --yes` | MIT |
| **21st.dev** | Huge catalog of marketing blocks (hero, pricing, features, testimonials, CTA) | registry URL or the `21st` CLI | mixed — check per item |
| **shadcnblocks** | Full marketing/section blocks | registry URL | check per item |
| **threecn** | React-Three-Fiber scenes (theme-aware) | `npx shadcn add "https://threecn.dev/r/<scene>.json"` | check |

## Notes
- The scaffold is Tailwind + shadcn, so ALL of the above drop in cleanly.
- threeui/threecn pull Three.js deps — fine, but keep them to the hero/background
  (heavy per-page); don't scatter 3D everywhere.
- Brand everything through `boilerplate/src/index.css` design tokens, not the
  component internals, so a pulled block instantly matches the brand.
- START with **threeui** (this is the first source we wired). More get added over time.
