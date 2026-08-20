---
name: telegram-userbot
description: Userbot Telegram через Telethon и прокси.
version: 1.0.0
author: hermes-agent
license: MIT
platforms:
  - linux
metadata:
  hermes:
    tags: [telegram, userbot, telethon, qr-login, proxy, socks5]
---

# telegram-userbot

## When to Use
Пользователь просит подключить ЕГО Telegram-аккаунт как userbot (Telethon) и/или
действовать от его имени: читать, писать, собирать участников, держать бота на
его аккаунте. Триггеры: «подключи мой аккаунт», «userbot», «телетон», «дай QR
для входа», «отправь от моего имени», «собери участников группы».

## Железные правила (нарушать нельзя)
1. **Сначала прокси, потом всё остальное.** Аккаунт никогда не подключается
   напрямую. Гео прокси = гео аккаунта (обычно просили Казахстан). Перед логином
   обязательно проверить IP (proxy.py check / curl ip-api.com). Логин с прямого
   IP = флаг на аккаунт.
2. **api_id/api_hash берутся у пользователя** (my.telegram.org → API development
   tools). Если их нет — попросить пользователя зарегистрировать приложение и
   прислать пару. Никогда не выдумывать и не брать чужие тестовые ключи.
3. **Файл сессии (*.session) — это ключ от аккаунта.** Не печатать, не копировать
   в архивы/логи, не передавать третьим лицам. Восстановлению не подлежит —
   утечка = потеря аккаунта.
4. QR-токен живёт ~25 секунд. Не отправлять пользователю старую картинку —
   ловить момент перерисовки qr.png и слать сразу. Присылать ТОЛЬКО картинку
   QR + инструкцию куда навести камеру; текстовую ссылку tg://login не
   отправлять (пользователю не нужна).

## Расположение и зависимости
Скрипты лежат рядом с этим SKILL.md в папке `scripts/` (на PVC агента —
`$HERMES_HOME/skills/telegram-userbot/scripts/`). Они self-locating: `config.json`
и файл сессии `*.session` пишутся ТУДА ЖЕ, рядом со скриптами, на постоянный диск
(PVC) → переживают перезапуск пода. Рабочая папка = папка скриптов, всегда
сначала `cd $HERMES_HOME/skills/telegram-userbot/scripts`.

- Скрипты: `scripts/ub_common.py`, `scripts/proxy.py`, `scripts/qr_login.py`,
  `scripts/send.py`, `scripts/read.py`, `scripts/members.py`, `scripts/ubot.py`.
  Шаблон конфига: `scripts/config.template.json`.
- Библиотеки: `pip install telethon qrcode pillow "python-socks[asyncio]"` —
  обычный системный pip. Установки ПЕРЕЖИВАЮТ рестарт пода через overlay-персист
  образа (upper на PVC), поэтому отдельный `--target`/`PYTHONPATH` больше не нужен.
- Аренда прокси: skill `proxy` (PROXY_URL/PROXY_TOKEN/PROXY_USER_ID, country=kz,
  sticky=true) или готовый `python3 proxy.py lease kz`.

## Порядок подключения нового аккаунта
Всё — из папки скриптов: `cd $HERMES_HOME/skills/telegram-userbot/scripts`.
1. `cp config.template.json config.json`, получить у пользователя api_id + api_hash
   → вписать в `config.json`.
2. `python3 proxy.py lease kz` — арендовать sticky-прокси, убедиться, что гео
   отвечает (если узел мёртв — `python3 proxy.py renew`).
3. `python3 qr_login.py qr` (фоновым процессом) — он крутит QR каждые ~25с,
   пишет qr.png (qr_url.txt — только для отладки). Схватить свежий кадр сразу
   после перерисовки и отправить пользователю ОДНОЙ картинкой, без ссылки-дубля.
   Скрипт сам напечатает SUCCESS с данными аккаунта, когда пользователь
   отсканирует (Telegram → Настройки → Устройства → Подключить устройство).
4. Проверка: `python3 qr_login.py status` → СЕССИЯ АКТИВНА + whoami.
5. Если у аккаунта 2FA — qr_login.py phone-режим спросит код и облачный пароль.

## Использование аккаунта (все — через прокси из config.json)
- `python3 send.py <кому> "текст"` — кому: @username / id / -100… / me (Избранное);
  `--file путь --file-caption подпись` для файлов.
- `python3 read.py <откуда> [лимит]` — последние сообщения.
- `python3 members.py <группа> [лимит]` — участники → CSV (нужны права).
- `python3 ubot.py [id1,id2]` — живой бот с командами .ping/.whoami/.id/.echo,
  фоновым процессом; фильтр по sender_id через аргумент.
- `python3 proxy.py check|lease|renew|release` — обслуживание прокси.

## Грабли, на которые уже наступили (не повторять)
- Telethon игнорирует прокси без `python-socks` (PySocks недостаточно для async).
  Формат прокси-кортежа: `('socks5', host, port, True, user, password)`.
- `qr.wait()` без явного timeout ловит кривой expires от сервера и мгновенно
  истекает → бесконечная перегенерация QR. Всегда `await qr.wait(timeout=25)`,
  а `recreate()` — coroutine (`await`).
- У резидентных прокси бывают мёртвые узлы: соединение к SOCKS есть, а наружу
  ничего не ходит. Лечение — release + новый lease (не третий раз тот же).
- Sticky-IP живёт ~24ч; если прокси умер среди боя — `proxy.py renew` и дальше
  работать, сессия не слетает.
- В терминале bash-кавычки в JSON-аргументах curl ломаются — для аренды
  использовать proxy.py, а не сырые curl-строки.
