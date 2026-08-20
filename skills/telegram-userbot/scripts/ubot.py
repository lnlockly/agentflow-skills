#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Постоянно работающий userbot: слушает команды в «своём» чате Saved Messages
или в любом чате, где упомянут. Запуск (из папки скрипта):
  python3 ubot.py [allowed_id1,id2]

Команды (в начале строки, адресованные боту):
  .ping       — ответ «pong» (проверка живости)
  .whoami     — данные аккаунта
  .id         — id текущего чата
  .echo текст — повторить текст
Останавливается по Ctrl+C.
"""
import asyncio
import sys

from telethon import events

from ub_common import load_config, client_from_config, check_proxy


async def main():
    allowed = []
    if len(sys.argv) > 1:
        allowed = [int(x) for x in sys.argv[1].split(',') if x.strip()]

    cfg = load_config()
    ok, msg = check_proxy(cfg)
    print('прокси:', 'OK —' if ok else 'ПРОБЛЕМА —', msg, flush=True)

    client = client_from_config(cfg)
    await client.connect()
    if not await client.is_user_authorized():
        print('СЕССИЯ НЕ АКТИВНА — сначала qr_login.py')
        return
    me = await client.get_me()
    print(f'UBOT ЗАПУЩЕН от @{me.username} (id {me.id})', flush=True)

    def from_allowed(event):
        return not allowed or event.sender_id in allowed

    @client.on(events.NewMessage(pattern=r'^\.ping'))
    async def _ping(event):
        if from_allowed(event):
            await event.reply('pong')

    @client.on(events.NewMessage(pattern=r'^\.whoami'))
    async def _whoami(event):
        if from_allowed(event):
            s = await event.get_sender()
            await event.reply(
                f"ты: {s.first_name} id={s.id} username=@{s.username}")

    @client.on(events.NewMessage(pattern=r'^\.id'))
    async def _id(event):
        if from_allowed(event):
            await event.reply(f"chat id: {event.chat_id}")

    @client.on(events.NewMessage(pattern=r'^\.echo (.+)'))
    async def _echo(event):
        if from_allowed(event):
            await event.reply(event.pattern_match.group(1))

    await client.run_until_disconnected()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print('остановлен')
