#!/usr/bin/env python3
"""
face_crop.py — speaker-tracking 9:16 reframe (the "virtual camera").

Reads a horizontal/landscape video, detects the speaker's face per frame with
MediaPipe (BlazeFace full-range), and computes a SMOOTHED horizontal crop centre
so the 1080x1920 window follows the subject WITHOUT jitter. The load-bearing
anti-jitter logic (per OpenShorts):

  * deadzone         — the subject may drift up to `deadzone` of the frame width
                       from centre before the camera bothers to move at all.
  * damped catch-up  — the camera eases toward the target by `smooth` each frame
                       (a low factor = slow, cinematic follow), never snapping.
  * jitter gate      — sub-`jitter`-pixel target moves are ignored outright.

Only the crop RECTANGLE is computed from (downscaled) detections; the actual
pixel crop is done with OpenCV and written video-only. The caller muxes the
original audio and normalises to a Telegram-safe encode.

Output: a single JSON line on stdout — {"status":"ok",...} on success, or
{"status":"fallback","reason":...} when deps are missing or too few frames had a
confident face (the caller then does a blurred-fit general crop in ffmpeg).

Usage:
  python3 face_crop.py --in IN.mp4 --out OUT.mp4 [--deadzone 0.15] [--smooth 0.3] [--jitter 5]
"""
import argparse
import json
import sys

TARGET_W, TARGET_H = 1080, 1920  # 9:16


def emit(obj):
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", dest="out", required=True)
    ap.add_argument("--deadzone", type=float, default=0.15)
    ap.add_argument("--smooth", type=float, default=0.3)
    ap.add_argument("--jitter", type=float, default=5.0)
    ap.add_argument("--detect-scale", type=float, default=0.5,
                    help="downscale factor for detection (speed).")
    args = ap.parse_args()

    try:
        import cv2
        import numpy as np
        import mediapipe as mp
    except Exception as e:  # deps not installed -> caller falls back to ffmpeg
        emit({"status": "fallback", "reason": f"deps missing: {e}"})
        return 0

    cap = cv2.VideoCapture(args.inp)
    if not cap.isOpened():
        emit({"status": "fallback", "reason": "cannot open input"})
        return 0

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    src_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    src_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if src_w == 0 or src_h == 0:
        emit({"status": "fallback", "reason": "zero dimensions"})
        return 0

    # The crop window is the tallest 9:16 rectangle that fits the source height.
    crop_h = src_h
    crop_w = int(round(crop_h * TARGET_W / TARGET_H))
    if crop_w > src_w:
        # Source is already narrow (portrait-ish): fall back to general fit.
        emit({"status": "fallback", "reason": "source not wide enough to track-crop"})
        return 0

    half = crop_w / 2.0
    min_cx, max_cx = half, src_w - half
    dead_px = args.deadzone * src_w

    detector = mp.solutions.face_detection.FaceDetection(
        model_selection=1, min_detection_confidence=0.5
    )

    # ---- Pass 1: per-frame target centre (last known centre when no face) ----
    centers = []
    faces_seen = 0
    frame_count = 0
    last_target = src_w / 2.0
    ds = max(0.2, min(1.0, args.detect_scale))
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frame_count += 1
        small = cv2.resize(frame, (0, 0), fx=ds, fy=ds) if ds != 1.0 else frame
        rgb = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)
        res = detector.process(rgb)
        if res and res.detections:
            faces_seen += 1
            # Largest / most confident detection wins (the speaker).
            best = max(
                res.detections,
                key=lambda d: d.location_data.relative_bounding_box.width
                * d.location_data.relative_bounding_box.height,
            )
            bb = best.location_data.relative_bounding_box
            last_target = (bb.xmin + bb.width / 2.0) * src_w  # relative -> source px
        centers.append(last_target)
    cap.release()

    if frame_count == 0:
        emit({"status": "fallback", "reason": "no frames read"})
        return 0
    coverage = faces_seen / frame_count
    if coverage < 0.2:
        # Not a talking-head we can confidently follow -> general blurred fit.
        emit({"status": "fallback", "reason": f"low face coverage {coverage:.2f}"})
        return 0

    # ---- Smooth the centre track: deadzone + jitter gate + damped catch-up ----
    smoothed = []
    cam = float(np.clip(centers[0], min_cx, max_cx))
    for target in centers:
        target = float(np.clip(target, min_cx, max_cx))
        delta = target - cam
        if abs(delta) < args.jitter:
            pass  # jitter gate: ignore micro-moves
        elif abs(delta) > dead_px:
            # Outside the deadzone: ease toward the edge of the deadzone, damped.
            edge = target - (dead_px if delta > 0 else -dead_px)
            cam += (edge - cam) * args.smooth
        # inside deadzone (but above jitter): hold the camera
        cam = float(np.clip(cam, min_cx, max_cx))
        smoothed.append(cam)

    # ---- Pass 2: crop each frame at its smoothed centre, scale to 1080x1920 ----
    cap = cv2.VideoCapture(args.inp)
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(args.out, fourcc, fps, (TARGET_W, TARGET_H))
    if not writer.isOpened():
        cap.release()
        emit({"status": "fallback", "reason": "cannot open VideoWriter"})
        return 0

    i = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        cx = smoothed[i] if i < len(smoothed) else smoothed[-1]
        x0 = int(round(cx - half))
        x0 = max(0, min(src_w - crop_w, x0))
        crop = frame[0:crop_h, x0:x0 + crop_w]
        out = cv2.resize(crop, (TARGET_W, TARGET_H), interpolation=cv2.INTER_AREA)
        writer.write(out)
        i += 1
    cap.release()
    writer.release()

    emit({"status": "ok", "frames": frame_count, "coverage": round(coverage, 3),
          "fps": round(fps, 3)})
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # never hard-crash: the caller has an ffmpeg fallback
        emit({"status": "fallback", "reason": f"exception: {e}"})
        sys.exit(0)
