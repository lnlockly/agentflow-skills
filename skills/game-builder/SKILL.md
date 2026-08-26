---
name: game-builder
description: Build a real, playable Babylon.js browser game from a description — scaffold it, get art (FREE asset hubs first, generate the rest), run it, prove it from the running game, and hand the user a public URL to play. Use whenever the user wants a game made, changed, or extended.
---

# Build Babylon.js game from a description

- Keep durable project status in `README.md`: what is built, what is left, and an asset table.
- Get visual assets with **the asset-gen tools (see asset-gen/SKILL.md)** — **FREE CC0 hubs
  FIRST** (ambientCG textures, Poly Pizza models, Kenney), generate only what's missing, and
  confirm the spend before the first paid generation.
- Read `engines/babylon.md` for engine guidance: stack, project layout, how to run, and how
  to capture — and heed its **silent-failure traps** (asset paths, side-effect imports).

## Delivery

Judge progress from the running game, never from a clean build: verify the structural things
yourself (it loads, no errors, **assets actually load in the built version, not just dev**) and
let what you see drive the next iteration. **Look at it with a browser** — headless
`google-chrome`, or `hermes computer-use` — screenshot the running game; a defect you can see is
the next task.

**The deliverable is a PUBLIC URL, not a local port.** A dev server on `:5173` inside the pod is
NOT reachable by the user. Build the game and publish the static bundle through the frp tunnel:

```bash
npx vite build                                              # → dist/ (self-contained)
python3 /opt/hermes-agent/publish.py serve dist <game-name> # prints the public https URL
```

Capture that `https://…sslip.io/` line and hand it to the user. **After publishing, screenshot
the PUBLIC url** (not just dev) and confirm the game actually renders — the #1 failure is a
build that drops assets and serves a blank page (see the babylon guide's asset trap).

Decide from how the task is framed how to work. A task that invites collaboration — open-ended,
exploratory, phrased as a direction rather than a spec — gets the live game early: checkpoint at
decisions of taste, scope, or cost, and build freely in between. A task handed over as a finished
brief to execute gets reasonable calls and steady progress, no blocking. Either way the result is
proven, not claimed — if the user hasn't seen it running, finish with a 15–20s video of the game
in action, and watch it back before you call the work done.
