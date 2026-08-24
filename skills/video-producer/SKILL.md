---
name: video-producer
description: Turn a blogger's talking-head video into a branded vertical Shorts/Reels with karaoke captions and "разбор/досье" motion graphics, then send it back in Telegram. Use whenever the user sends a video (or video+audio) and wants a finished reel, clip, or Shorts.
---

# Video Producer — «Режиссёр в кармане»

You turn a raw talking-head video into a **finished, branded vertical reel**
(1080×1920) in the viral «разбор / досье» style and send it back. The whole
pipeline runs inside your own pod — nothing leaves except the final MP4.

The video studio (a Remotion project) is pre-installed at **`/app/data/video-studio`**.

## When to use
The user sends a **video file** (talking head / podcast clip / selfie monologue),
optionally with a topic ("сделай разбор про измену", "нарежь шортс"). Produce a reel.

## How to produce a reel (do it yourself, end to end)

1. **Save the incoming video** the user sent to a file, e.g.
   `/app/data/video-studio/input/<name>.mp4`. If they also sent a separate
   audio/voiceover, note its path.
2. **Produce** — one command does transcribe (RU) → direct the storyboard with
   your LLM → generate/search photo inserts → render:
   ```bash
   cd /app/data/video-studio && bash setup.sh   # one-time, self-latches (fast after first run)
   node /app/data/video-studio/run.mjs "input/<name>.mp4" "тема, если задал юзер" [--theme dosie|razbor|krasny] [--audio "input/voice.m4a"]
   ```
   - Omit `--theme` to let the director pick (разбор=light/investigative,
     досье=dark/premium, красный=bold two-tone).
   - The last printed line is `OUT=/app/data/video-studio/out/<name>.mp4`.
3. **Send that MP4 back to the user** in Telegram (use your file-sending tool, or
   copy it into `/app/outbox/`). Add a short caption. Тот `OUT=…` путь — это готовый
   ролик.

The first ever run is slower (one-time npm install + Whisper model download, then
a ~60s render). Later runs are just transcribe → direct → render (~1–2 min total).
While it renders, tell the user you're working — don't go silent.

## Remember the user's brand
When the user states preferences — default theme, their @handle, a signature word,
"always dark" — **save them to memory** and apply them by default next time
(`--theme`, topic). Returning users get their look with zero re-explaining.

## Reliability
`run.mjs` always produces a reel: if the LLM director call fails it falls back to a
deterministic template; if an image insert can't be fetched that scene is skipped
and the render still completes. Never leave the user without a result — if something
truly fails, say what failed and offer to retry.

## Notes
- Cyrillic captions use Montserrat; the render is deterministic/headless.
- Image inserts use your native gpt-image-2 (no extra keys); Pexels if PEXELS_API_KEY set.
- Keep source footage + outputs under /app/data/video-studio (persists on your disk).
