# Babylon.js engine guide

Stack: **Babylon.js** (`@babylonjs/core` + `@babylonjs/loaders`), **Vite**, **TypeScript**, Node 22+.
The game is a **web page** — you serve it and hand the user a live URL to play, exactly
like a published funnel. That's the delivery: a link they open in a browser.

## Project shape

A plain Vite + TS project is enough. Scaffold one (`npm create vite@latest . -- --template vanilla-ts`),
add `@babylonjs/core` and `@babylonjs/loaders`, then:

- A fullscreen `<canvas>` in `index.html` and a render loop: create an `Engine`, build a
  `Scene`, call `engine.runRenderLoop(() => scene.render())`, resize on `window`.
- Gameplay in `src/` modules; generated/downloaded assets under `src/assets/`, loaded
  through Vite (`import url from './assets/x.glb?url'`).
- Drive gameplay off `scene.onBeforeRenderObservable` + the engine delta — never assume a
  fixed frame rate.

Commands: `npm install` · `npm run dev` · `npm run build` (build is a compile gate, NOT
proof the game runs — only the running page is proof).

**Bind the dev server to `0.0.0.0` on a fixed port** (`server: { host: true, port: 5173 }`)
so it can be tunnelled. Keep `npm run dev` running.

## Delivery — hand the user a live URL

Expose the running dev server publicly with the **publish/expose skill** (the same
frp / sslip.io path the bot-builder uses for funnels): give the user
`https://<sub>.<host>.sslip.io` (or the frp URL). You edit, they refresh and play.
Run the server under **pm2** so it survives (`pm2 start "npm run dev" --name <game>` +
`pm2 save`). Persist the project under `/app/data/` so it survives pod restarts.

## Assets (silent BUILD trap — bit us live)

**Never load an asset by a raw `/src/...` string path** (e.g. `new Texture("/src/assets/tex/x.jpg")`).
It works in `npm run dev` (Vite serves `/src/`) but **404s in the built `dist/`** — Vite only
copies assets that are IMPORTED — so the published game renders blank with no error. Two safe ways:

- **Import with `?url`** and pass the resolved URL:
  `import grassUrl from "./assets/tex/Grass005/Color.jpg?url"; new Texture(grassUrl, scene);`
- **or put the file in `public/`** and reference it by root path (`new Texture("/tex/x.jpg")`) —
  `public/` is copied verbatim into `dist/`.

Verify after building: `npm run build && curl -sI http://<served-dist>/<asset-path>` must be 200,
not 404. A dev-only path is the #1 reason a published game looks empty.

Also add a **loading screen**: gate the canvas behind a "Загрузка…" overlay you remove only after
`scene.executeWhenReady()` + your textures/GLBs report loaded — otherwise the first seconds are a
black screen.

## Imports (silent runtime trap)

Import from `@babylonjs/core` subpaths (e.g. `@babylonjs/core/Meshes/meshBuilder`). Some
features are registered by a **side-effect module** that tree-shaking drops — code
compiles but throws at runtime: `"<Feature> needs to be imported before it can be used"`.
Add the named side-effect import it asks for, e.g. `import "@babylonjs/core/Meshes/instancedMesh"`,
`import "@babylonjs/core/Culling/ray"`, `import "@babylonjs/loaders/glTF"`.

## Physics

Havok via `@babylonjs/havok`. Serve `HavokPhysics.wasm` from `public/` and load with
`HavokPhysics({ locateFile: () => "/HavokPhysics.wasm" })` — a `?url` import is blocked by
the package `exports`. Enabling physics needs its side-effect module registered (rule
above); then use `PhysicsAggregate`.

## Capture (self-verify + proof video)

Load the running dev URL in **headless Chrome** (`playwright-core`, or `google-chrome
--headless`) and screenshot. This is how you verify your own work AND make the proof clip.

- ⚠ **No GPU in the sandbox.** These pods (gVisor) have no GPU — headless Chrome falls back
  to SwiftShader (software WebGL). It renders, but slowly. Fine for **2D and light low-poly
  3D**; for heavy 3D the frame rate will be poor — say so honestly and keep scenes light, or
  ask the owner for a GPU node. Read the WebGL `RENDERER` string; if it's `swiftshader`/
  `llvmpipe`, warn and cap scene complexity.
- **Wait before shooting.** Screenshot only after the scene rendered a frame and GLBs/
  textures loaded — gate on a ready flag the game sets, or settle after network-idle. Too
  early = a misleading blank frame.
- **Proof video:** screenshot on an interval (~30fps for 15–20s) into a temp dir, then
  `ffmpeg -framerate 30 -i frame_%04d.png -c:v libx264 -pix_fmt yuv420p proof.mp4`. Deliver
  it via the send_file path, and **watch it back before calling the work done.**

## Babylon API lookups

For exact import paths / loader behaviour on the installed version, read the package
sources under `node_modules/@babylonjs/core` and `node_modules/@babylonjs/loaders`; fall
back to `https://doc.babylonjs.com/`.
