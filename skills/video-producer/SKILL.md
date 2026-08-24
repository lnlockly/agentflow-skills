---
name: video-producer
description: Turn a blogger's talking-head footage into a branded vertical Shorts/Reels video with karaoke captions and "разбор/досье" motion graphics, then deliver it in Telegram. Use whenever the user sends a video (or video+audio) and wants a finished reel, clip, or Shorts.
---

# Video Producer — «Режиссёр в кармане»

You turn raw talking-head footage into a **finished, branded vertical reel** (1080×1920)
in the viral «разбор / досье» style: split layout (motion-graphics on top, footage
below), a persistent HUD with a chapter stepper, karaoke captions with red keyword
highlights, and one motion-graphic per beat (voice bubbles, story steppers, stat
chips, relationship cards, stamps, generated photo inserts, full-bleed punch words).

The whole pipeline runs **inside your own pod** — nothing leaves except the final MP4.

## When to use
The user sends a **video file** (talking head / podcast clip / selfie monologue),
optionally with a topic ("сделай разбор про измену", "нарежь шортс"). Produce a reel.

## How to produce a reel (do this yourself, end to end)

1. **Save the incoming file** the user sent to a path in this skill directory (e.g.
   `input/<name>.mp4`). If they sent a separate audio/voiceover, note its path.
2. **Prep once** (safe to run every time — it self-latches):
   ```bash
   bash setup.sh
   ```
3. **Run the producer** — this transcribes (RU), directs the storyboard with the
   LLM, generates/searches any photo inserts, and renders:
   ```bash
   node run.mjs "input/<name>.mp4" "тема ролика, если задал юзер" [--theme dosie|razbor|krasny] [--audio "input/voice.m4a"]
   ```
   - Omit `--theme` to let the director pick (разбор = light/investigative,
     досье = dark/premium, красный = bold two-tone).
   - The last line printed is `OUT=/abs/path/to/out/<name>.mp4`.
4. **Deliver the file** `OUT=…` back to the user in Telegram (send it as a video/
   document — use your file-sending tool / the outbox). Add a short caption.

The first run is slower (npm install + a one-time Whisper model download, then a
~60s render); later runs are just transcribe → direct → render.

## Remember the user's brand
When the user states preferences — default theme, their @handle, a signature word,
"always dark", "put my logo" — **save them to memory** and apply them by default on
the next reel (pass `--theme`, adjust the topic). This memory is the moat: returning
users get their look with zero re-explaining.

## Reliability
`run.mjs` always produces a reel: if the LLM director fails, it falls back to a
deterministic template storyboard. If an image insert can't be fetched, that scene
is skipped and the render still completes. Never leave the user without a result —
if something truly fails, say what failed and offer to retry.

## Notes
- Cyrillic captions use Montserrat 900; the render is deterministic/headless (gVisor).
- Image inserts are generated via the native `gpt-image-2` path (no extra keys) or
  searched on Pexels if `PEXELS_API_KEY` is set.
- Keep source footage and outputs under this skill dir; they persist on the PVC.
