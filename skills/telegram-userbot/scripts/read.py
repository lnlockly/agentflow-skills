#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Прочитать последние сообщения чата/канала:
  read.py <откуда> [лимит]        — @username / id / ссылка на чат
Примеры:
  read.py @durov 10
  read.py -1001234567890 5
"""
import argparse
import asyncio
import sys

from ub_common import load_config, client_from_config, check_proxy


def fmt_ts(d):
    return d.strftime('%d.%m %H:%M') if d else '—'


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('from_where')
    ap.add_argument('limit', nargs='?', type=int, default=10)
    args = ap.parse_args()

    cfg = load_config()
    ok, msg = check_proxy(cfg)
    print('прокси:', 'OK —' if ok else 'ПРОБЛЕМА —', msg)
    if not ok and cfg.get('proxy'):
        sys.exit(1)

    client = client_from_config(cfg)
    await client.connect()
    if not await client.is_user_authorized():
        print('СЕССИЯ НЕ АКТИВНА — сначала qr_login.py')
        sys.exit(2)
    try:
        entity = await client.get_entity(args.from_where)
        title = getattr(entity, 'title', None) or getattr(entity, 'username', '')
        print(f'=== {title} — последние {args.limit} сообщений ===')
        async for m in client.iter_messages(entity, limit=args.limit):
            sender = ''
            if m.sender:
                sender = (f"{m.sender.first_name or ''} "
                          f"@{m.sender.username}" if m.sender.username
                          else (m.sender.first_name or str(m.sender.id)))
            text = (m.text or '').replace('\n', ' ')[:120]
            print(f"[{fmt_ts(m.date)}] {sender}: {text}")
    finally:
        await client.disconnect()


if __name__ == '__main__':
    asyncio.run(main())
