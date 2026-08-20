#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Отправить сообщение от имени аккаунта:
  send.py <кому> <текст>          — кому: @username / +7... / id / ссылка на чат
  send.py <кому> --file <путь>    — отправить файл (фото/док) с подписью из --file-caption
Примеры:
  send.py @durov "Привет"
  send.py -1001234567890 "Всем привет"
  send.py @channel --file photo.jpg --file-caption "подпись"
"""
import argparse
import asyncio
import os
import sys

from ub_common import load_config, client_from_config, check_proxy


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('to')
    ap.add_argument('text', nargs='?', default='')
    ap.add_argument('--file', dest='filepath')
    ap.add_argument('--file-caption', dest='caption', default='')
    ap.add_argument('--reply', dest='reply_to', type=int)
    args = ap.parse_args()

    cfg = load_config()
    ok, msg = check_proxy(cfg)
    print('проки:', 'OK —' if ok else 'ПРОБЛЕМА —', msg)
    if not ok and cfg.get('proxy'):
        sys.exit(1)

    client = client_from_config(cfg)
    await client.connect()
    if not await client.is_user_authorized():
        print('СЕССИЯ НЕ АКТИВНА — сначала qr_login.py')
        sys.exit(2)
    try:
        entity = await client.get_entity(args.to)
        if args.filepath:
            if not os.path.exists(args.filepath):
                print('файл не найден:', args.filepath)
                sys.exit(1)
            msg_out = await client.send_file(
                entity, args.filepath, caption=args.caption or None,
                reply_to=args.reply_to)
            print('ОТПРАВЛЕН ФАЙЛ id', msg_out.id)
        elif args.text:
            msg_out = await client.send_message(
                entity, args.text, reply_to=args.reply_to)
            print('ОТПРАВЛЕНО сообщение id', msg_out.id)
        else:
            print('нечего отправлять: нужен текст или --file')
            sys.exit(1)
    finally:
        await client.disconnect()


if __name__ == '__main__':
    asyncio.run(main())
