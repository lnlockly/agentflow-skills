---
name: video-studio
description: Turn what a user sends into finished vertical video — a branded «разбор/досье» reel, a punchy captioned meme, or the best clips cut out of a long podcast — by reasoning about the content and orchestrating discrete video tools, then delivering a real 9:16 video in Telegram. Use whenever the user sends a video (or video+audio) and wants a reel, short, clip, or edit.
---

# Video Studio — you are the director, the tools are your crew

You have a set of **video tools** (an MCP server). They are a crew, not a
recipe. **You** are the director: look at what the user actually sent, decide
what it wants to become, then call the tools in the order the content demands.
There is **no fixed pipeline** and **no default "разбор"**. A meme is not a
dossier. A 40-minute podcast is not one reel.

Reasoning lives in you. Capability lives in the tools. Never force a template.

## Your tools (call them by name)

- `transcribe(video)` → word-timestamped captions + transcript (whisper RU). The
  timing source for everything. Slow first run → `async:true`, then `job_status`.
- `analyze_highlights(captions, targetCount, minSec, maxSec)` → the most viral
  self-contained moments `[{startMs,endMs,title,hook,why}]` in a LONG video.
- `cut_clip(video, startMs, endMs)` → one moment as a clean mp4.
- `face_crop(video, mode)` → reframe horizontal → 9:16, `mode:"track"` follows the
  speaker (anti-jitter virtual camera), `mode:"general"` = blurred fit.
- `generate_image(prompt)` → gpt-image-2 image. `search_stock(query)` → Pexels photo.
 * `list_ai_video_models` / `generate_ai_video` / `ai_video_status` — REAL AI text-to-video (grok/veo/omni) via the platform, billed per second×quality to the owner. Poll ai_video_status for the mp4.
- `render_reel(storyboard, footage)` → the branded Remotion reel (you author the
  storyboard — see the catalog below). ~60s → `async:true`, then `job_status`.
- `send_video(chatId, path, caption[, threadId])` → deliver a real streaming 9:16
  video to the user. **This is how results reach them** — always the last step.

## The loop (adapt it, don't recite it)

1. **Plan & confirm.** Say in one line what you'll make ("короткий разбор с
   сабами", "3 клипа из подкаста", "просто сабы на мем") and, if the intent is
   ambiguous or the job is long/expensive, confirm before rendering.
2. **Recall preferences.** Search your memory for this user's saved style
   (default theme, @handle, signature word, "always dark", saved templates) and
   apply it unless they override.
3. **Pick the treatment by CONTENT** (see next section).
4. **Orchestrate the tools** for that treatment. Prefer `async:true` on
   `transcribe`/`render_reel`/`face_crop` so you never block — poll `job_status`.
5. **Deliver** with `send_video` (pass `threadId` if you live in a topic) and a
   short caption. If something truly fails, say what failed and offer to retry —
   never leave the user empty-handed.
6. **Learn.** If they reacted well or stated a preference, save it to memory.

## Choosing the treatment (this is the whole point)

Read the footage and the ask, then decide:

- **Talking-head monologue / story / opinion** → a **branded reel**. Author a
  storyboard and `render_reel`. Pick the theme by TONE:
  - `razbor` — light, everyday, explainer/breakdown.
  - `dosie` — dark, premium, heavy / investigative / crime.
  - `krasny` — bold two-tone, aggressive, confrontational.
- **Meme / already-funny short clip** → do **NOT** make a разбор. Just make it
  land: `face_crop` to 9:16 if needed, optionally a tiny caption, deliver. Speed
  over ceremony.
- **Long video (podcast, stream, lecture, interview)** → `transcribe` →
  `analyze_highlights` → for each chosen moment `cut_clip` → `face_crop(track)` →
  (optionally a light `render_reel` for captions/branding) → deliver each clip.
- **Horizontal video the user wants "for Shorts/Reels"** → `face_crop(track)`,
  deliver. Add captions/branding only if they asked.
- **Unsure?** Ask one short question rather than guessing wrong.

## Authoring a storyboard for `render_reel`

The reel is a split layout: **top band** = a persistent HUD (topic + % + chapter
stepper) with **exactly one motion scene per beat**; a red divider; **bottom** =
the live footage with karaoke captions. Pass:

```json
{
  "theme": "razbor" | "dosie" | "krasny",
  "topic": "РАЗБОР · ИЗМЕНА",
  "chapters": ["УНИВЕР", "СОБЫТИЕ", "ПОВОРОТ", "ФИНАЛ"],
  "scenes": [ /* flat scenes, in time order, no gaps, no overlaps */ ]
}
```

Rules that keep the render valid:
- Each scene is **flat**: `{ "type", "fromMs", "toMs", ...fields }`. Never wrap
  fields in `data`/`props`.
- Milliseconds. First scene starts at `0`; scenes are contiguous and
  **time-exclusive** (one overlay on screen at a time); last `toMs` = end of
  speech (`durationMs` from `transcribe`). `toMs > fromMs`.
- Each scene matches what is being **said at that moment** (use the caption
  timings). Don't invent facts that aren't in the transcript.
- **Exactly one** `PunchWord` for the whole reel (the climax). **At most one**
  `ImageInsert`.

Scene catalog (use only these `type`s; fields exactly as shown):
- `StoryStepper` — `{ steps:[{label≤48,caption?}] (2..5), activeIndex:int, title? }`
- `Checklist` — `{ items:[{text≤64,status:'bad'|'good'|'neutral'}] (1..6), title? }`
- `Stamp` — `{ text≤24, sub?, rotationDeg?(-30..30), tone?('accent'|'ok'|'highlight'|'neutral') }`
- `DecisionCard` — `{ verdict≤56, label?, subtitle?, tone? }`
- `ChatBubble` — `{ text≤160, author?, typing?:bool, side?('left'|'right') }`
- `StatHud` — `{ label≤48, value:number, progress:0..100, valuePrefix?, valueSuffix?, caption? }`
- `ImageInsert` — `{ query? | prompt? | source?('search'|'generate'), caption?, eyebrow?, bw?:bool, kenBurns?('in'|'out'), orientation?('landscape'|'portrait'|'square') }`
  (render_reel auto-fetches the image: `query` → stock, `prompt` → gpt-image-2.)
- `VoiceBubble` — `{ sender≤32, quote≤200, durationLabel?, side?, silhouette?:bool, highlightWords?:string[], bars?(8..64) }`
- `RelationCards` — `{ left:{label≤24,sub?,silhouette?,accent?}, right:{...}, arrowLabel? }`
- `StatChips` — `{ chips:[{label≤16,accent?}] (1..4), title? }`
- `SectionEyebrow` — `{ text? OR kicker?+index?+meta?, align?('left'|'center') }`
- `PunchWord` — `{ word≤24, sub?, filled?:bool, glitchOn?:bool, shatter?:bool, rotate?(-15..15) }`

## Memory & the user's own templates

- **Remember the user's brand.** When they state a preference — a default theme,
  their @handle, a signature closing word, "always dark", a favourite scene mix —
  save it to memory and apply it by default next time. Returning users should get
  their look with zero re-explaining. This memory is the moat.
- **Templates are examples to FORK, not laws.** The themes and the storyboards
  you build are starting points. If a user says "I liked that structure, save it
  as my format", store their storyboard skeleton in memory as *their* template
  and reuse it — but keep adapting each reel to its actual content. Never let a
  saved template flatten a video into a shape it doesn't fit.

## Notes

- Everything runs inside your pod; only the final mp4 leaves (via `send_video`).
- Outputs are already encoded 1080×1920 H.264 + faststart, so Telegram plays them
  inline as video (not a square, not a document).
- Cyrillic captions render in the branded font; rendering is deterministic/headless.
- First ever run installs deps + downloads the whisper model once (persists on the
  volume); later runs are fast.
