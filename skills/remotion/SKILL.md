---
name: remotion
description: Генерация видео программно через Remotion (React) — анимации, ролики, сторис.
version: 1.0.0
author: hermes-agent
license: MIT
platforms:
  - linux
metadata:
  hermes:
    tags: [video, remotion, react, animation, motion, сторис, ролик]
---

# remotion

## When to Use
Пользователь просит СДЕЛАТЬ ВИДЕО / АНИМАЦИЮ / РОЛИК / сторис / motion-графику
программно: анимированный текст, промо-ролик, интро, слайд-шоу из картинок,
titles, анимация логотипа. Триггеры: «сделай видео», «анимируй», «ролик»,
«сторис», «motion», «видео из картинок».

НЕ для: простой нарезки/склейки готового видео (это ffmpeg) и не для генерации
видео нейросетью «из текста» — Remotion РИСУЕТ кадры кодом (React), это
управляемая моушн-графика, а не text-to-video.

## Что это
Remotion рендерит видео из React-компонентов: каждый кадр — это отрисованный
React, `useCurrentFrame()` даёт номер кадра для анимаций. Рендер идёт через
headless-Chromium (в образе уже есть) в MP4/WebM/GIF.

## Установка (один раз, переживает рестарт через overlay)
```bash
# Рабочая папка на PVC, чтобы проект и node_modules сохранялись:
mkdir -p /app/data/home/video && cd /app/data/home/video
npm init -y >/dev/null 2>&1
npm i remotion @remotion/cli @remotion/bundler react react-dom
# указать Remotion на уже установленный chromium (не качать свой):
export REMOTION_CHROMIUM_EXECUTABLE="$(ls /root/.cache/ms-playwright/chromium-*/chrome-linux64/chrome 2>/dev/null | head -1)"
```

## Как сделать ролик
1. Рабочая папка: `cd /app/data/home/video`.
2. Создать композицию — `src/Video.tsx` (React-компонент с анимацией через
   `useCurrentFrame`, `interpolate`, `spring`) и `src/index.ts` c
   `registerRoot` + `<Composition id="Main" .../>` (fps, durationInFrames,
   width/height — для сторис 1080×1920, для обычного 1920×1080).
3. Рендер в файл (Chromium уже есть, не давать качать свой):
   ```bash
   export REMOTION_CHROMIUM_EXECUTABLE="$(ls /root/.cache/ms-playwright/chromium-*/chrome-linux64/chrome 2>/dev/null | head -1)"
   npx remotion render src/index.ts Main /app/outbox/video.mp4
   ```
4. Готовый MP4 кладётся в `/app/outbox/` → уходит пользователю автоматически.

## Железные правила
1. **Рендер идёт минуты** (зависит от длины/fps). Предупреди пользователя
   («Рендерю видео, займёт пару минут ⏳») и НЕ обрывай по таймауту.
2. **Всегда** `REMOTION_CHROMIUM_EXECUTABLE` на баковый chromium — иначе Remotion
   попытается скачать свой браузер (лишний трафик/время, может не встать).
3. Проект и `node_modules` — в `/app/data/home/video` (на PVC), НЕ в /tmp: тогда
   при следующем запросе не переустанавливать.
4. Картинки/ассеты для видео клади в `public/` внутри проекта, ссылайся `staticFile()`.
5. Итог — ОДИН файл в `/app/outbox/`, короткое имя латиницей.

## Быстрые рецепты
- Видео из картинок (слайд-шоу): по кадру-на-слайд с `interpolate` для fade/zoom,
  картинки через `<Img src={staticFile('1.png')} />`.
- Анимированный заголовок: `spring()` на прозрачность/сдвиг текста.
- Комбо с image-gen: сгенерь кадры скиллом `image-gen`, положи в `public/`,
  собери из них ролик Remotion'ом.
