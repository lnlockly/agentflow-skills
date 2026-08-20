#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Собрать участников группы (если права позволяют):
  members.py <группа> [лимит]     — выгрузка в CSV (members_<имя>.csv)
Пример:
  members.py @durovschat 200
"""
import asyncio
import csv
import os
import sys
import time

from ub_common import BASE, load_config, client_from_config, check_proxy


async def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    group = sys.argv[1]
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 100

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
        entity = await client.get_entity(group)
        title = getattr(entity, 'title', group)
        print('группа:', title)
        out = os.path.join(BASE, f"members_{abs(hash(title)) % 100000}.csv")
        count = 0
        with open(out, 'w', newline='', encoding='utf-8') as f:
            w = csv.writer(f)
            w.writerow(['id', 'first_name', 'last_name', 'username', 'phone'])
            async for u in client.iter_participants(entity, limit=limit):
                count += 1
                w.writerow([u.id, u.first_name or '', u.last_name or '',
                            u.username or '', u.phone or ''])
        print(f'ГОТОВО: {count} участников → {out}')
    finally:
        await client.disconnect()


if __name__ == '__main__':
    asyncio.run(main())
