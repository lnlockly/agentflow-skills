---
name: game-builder
description: Build a real, playable browser game (Babylon.js) from a description — scaffold the project, get art (free hubs first, generate the rest), run it, and PROVE it from the running game with a live URL to play plus a short proof clip. Use whenever the user wants a game made, changed, or extended.
---

# Game Builder — from a description to a playable game

You build the user a **real, playable Babylon.js game**, serve it at a live URL, and prove
it works by the running game — not by a clean compile. You WRITE CODE; a short engine guide
carries the stack and the traps, and an asset skill gets you art. Everything is editable and
grows with the user.

## The flow (be DYNAMIC — plan, don't just dump)
1. **Understand + PLAN.** What game, genre, vibe, scope? Recall the user's past games/taste
   from memory. A capable model plans and decomposes the work itself — there's no fixed
   pipeline here. Two things are fixed: **where durable state lives** and **that the result
   is proven from the running game**.
2. **Keep durable status in `README.md`** — what's built, what's left, and the **asset table**
   (name · size · licence · path · source/cost). This survives context compaction, so a long
   run picks up where it left off. Update it as you go.
3. **Stand up the project** from `engines/babylon.md` (Vite + Babylon + TS). Persist it under
   `/app/data/<game>/` and run the dev server under pm2.
4. **Get art with `asset-gen`.** FREE CC0/permissive hubs FIRST (textures, models) — it's free
   and instant; **generate only what's specific/missing**, and **confirm the spend before the
   first paid generation.** Record every asset's licence + in-game size in the README table.
5. **Build the game as code.** Gameplay in `src/` off `scene.onBeforeRenderObservable` + delta.
   Watch for the Babylon side-effect-import trap (guide). `npm run build` is a compile gate,
   not proof.
6. **PROVE it (the point).** Judge from the running game: verify the structural things yourself
   (it loads, no console errors, assets present), then **let what you SEE drive the next
   iteration** — a visible defect is the next task, not a passing build. Capture via headless
   Chrome (guide) — mind the no-GPU note.
7. **PUBLISH — REQUIRED, the deliverable is a PUBLIC URL, not a local port.** A running dev
   server on `:5173` inside the pod is NOT reachable by the user — you MUST expose it. Build
   the game and publish the static bundle through the frp tunnel:
   ```bash
   npx vite build                                              # → dist/ (self-contained)
   python3 /opt/hermes-agent/publish.py serve dist <game-name> # prints the public https URL
   ```
   `publish.py serve` stays running to keep the tunnel alive and prints
   `https://<sub>.<host>.sslip.io/` — **capture that exact line and hand it to the user.** Not
   done until the user has a working link. (`publish.py` only serves a static folder — build
   first; the live-editing dev server on `:5173` is for YOUR iteration, not for delivery.)

## Delivery — read the user's framing
- **The deliverable is the public URL** from step 7 — the user opens it and plays. You keep the
  dev server for your own edits; ship them the built, published link.
- **An open-ended, exploratory task** (a direction, not a spec) → publish EARLY and checkpoint
  at decisions of taste, scope, or cost; rebuild + republish as you go (same name = same URL).
- **A finished brief handed over to execute** → make reasonable calls, steady progress, don't
  block; finish with the public URL and, if the user hasn't watched it, a **15–20s proof clip**
  of the game in action — **watch it back before you call it done.**

## Rules (the canon)
- **Proof over claims** — the running game is the truth; a clean build is not.
- **Free assets first, generate second** — confirm any paid spend; record licences (ship-safe).
- **Trust the model, ship no rigid pipeline** — plan and decompose per game; the guide spends
  words only on what you genuinely can't infer (project shape, capture recipe, silent traps).
- **Keep durable state in README** so a long run survives compaction.
- **Persist under `/app/data/` + pm2** so the game and its URL outlive pod restarts.

## Remember the user
Save the user's games, preferred genres, art style, and difficulty/taste to memory — and
reuse them by default next time.
