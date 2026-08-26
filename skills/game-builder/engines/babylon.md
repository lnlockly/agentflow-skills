# Babylon.js engine guide

Stack: **Babylon.js** (`@babylonjs/core` + `@babylonjs/loaders`), **Vite**, **TypeScript**, Node 22+.

## Project shape

A plain Vite + TS project is enough. Scaffold one (`npm create vite@latest . -- --template vanilla-ts`), add `@babylonjs/core` and `@babylonjs/loaders`, then:

- A fullscreen `<canvas>` in `index.html` and a render loop: create an `Engine`, build a `Scene`, call `engine.runRenderLoop(() => scene.render())`, and resize on `window`.
- Put gameplay in `src/` modules; keep generated assets under `src/assets/` and load them through Vite (`import url from './assets/x.glb?url'`).
- Drive gameplay off `scene.onBeforeRenderObservable` and the engine delta — don't assume a fixed frame rate.

> ⚠️ **Asset-path BUILD trap (this shipped a blank game once).** NEVER load an asset by a raw
> `/src/...` string (`new Texture("/src/assets/tex/x.jpg")`). It works in `npm run dev` (Vite
> serves `/src/`) but **404s in the built `dist/`** — Vite only copies IMPORTED assets — so the
> published game is blank with no error. Always either **`import url from "./assets/..?url"`** and
> pass the resolved url, **or** put the file in `public/` and reference it by root path. After
> building, `curl -sI <served>/‹asset›` must be **200**. Also show a **loading screen** until
> `scene.executeWhenReady()` fires, or the first seconds are black.

Commands: `npm install` · `npm run dev` · `npm run build` (use the build as a compile gate, but it is not proof the game runs — only the running page is).

**Bind the dev server to `0.0.0.0` on a fixed port** (`server: { host: true, port: 5173 }`). Keep `npm run dev` for YOUR own iteration. **Deliver to the user via a public URL**, not the port: `npx vite build` → `python3 /opt/hermes-agent/publish.py serve dist <name>` prints an `https://…sslip.io/` link — that's what you hand over. Rebuild + republish (same name = same URL) as you iterate.

## Imports

Import from `@babylonjs/core` subpaths (e.g. `@babylonjs/core/Meshes/meshBuilder`). Some features are registered by a **side-effect module** that tree-shaking drops — code compiles but throws at runtime with `"<Feature> needs to be imported before it can be used"`. When you hit that, add the named side-effect import it asks for (e.g. `import "@babylonjs/core/Meshes/instancedMesh"`, `import "@babylonjs/core/Culling/ray"`, `import "@babylonjs/loaders/glTF"`).

## Physics

Havok is available via `@babylonjs/havok`. Serve `HavokPhysics.wasm` from `public/` and load it with `HavokPhysics({ locateFile: () => "/HavokPhysics.wasm" })` — a `?url` import is blocked by the package `exports`. Enabling physics needs its side-effect module registered (per the rule above); then use `PhysicsAggregate`.

## Capture (self-verify + proof video)

Load the running URL in **headless `google-chrome`** (baked into the agent image) or via
`hermes computer-use`, and screenshot. This is how you verify your own work and produce the proof
video — **screenshot the PUBLISHED url after building**, not only dev, so you catch the asset trap.

- **No GPU here (gVisor pods).** Headless Chrome falls back to **SwiftShader** (software WebGL) — it
  renders, but slowly. Pass `--headless=new --disable-gpu --enable-unsafe-swiftshader` and give it a
  couple seconds. Fine for **2D and light low-poly 3D**; keep scenes light or heavy 3D crawls — say
  so honestly. Read the WebGL `RENDERER` string; if `swiftshader`, cap complexity.
- **Wait before shooting.** Capture only after the scene has rendered a frame and textures/GLBs have loaded — gate on a ready flag the game sets, or settle a fixed delay after network idle. Screenshotting too early gives a misleading blank frame.
- **Proof video:** screenshot on an interval (~30fps for 15–20s) into a temp dir, then encode at ~720p: `ffmpeg -framerate 30 -i frame_%04d.png -c:v libx264 -pix_fmt yuv420p proof.mp4`.

## Babylon API lookups

For exact import paths, loader behavior, or Vite specifics on the installed version, read the package sources under `node_modules/@babylonjs/core` and `node_modules/@babylonjs/loaders`; fall back to `https://doc.babylonjs.com/`.
