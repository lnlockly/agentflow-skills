---
name: agent-tools
description: Default media tools every AgentFlow agent has out of the box — generate real AI text-to-video (generate_ai_video → ai_video_status) and AI voiceover / text-to-speech (speak), with discovery via list_ai_video_models and list_voices. Use whenever the user asks for an AI-generated video clip or a spoken voiceover; no template required.
---

# Agent media — AI video + voice, available by default

These tools ship with **every** agent (no template needed). They are the thin, primitive media slice: you call the platform (Control-Plane) as the owner, the platform bills the owner tokens per second of video / per character of speech, and the provider's secret key never leaves the server. Use `list_ai_video_models` / `list_voices` to discover options and cost, `generate_ai_video` to start a real AI text-to-video job (then poll `ai_video_status`, which downloads the finished mp4 through the platform content-proxy when it is ready), and `speak` to synthesize an AI voiceover mp3. Heavier capabilities — the full Remotion render/subtitle pipeline, whisper transcription, clip cutting, face-tracking — are added by the `video-studio` template, not here.
