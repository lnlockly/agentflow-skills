#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Логин аккаунта через прокси. Три способа на выбор:
  qr_login.py qr          — QR-код (картинка qr.png + ссылка tg://login)
  qr_login.py phone       — телефон + код из SMS/Telegram
  qr_login.py status      — проверить текущую сессию
Сессия сохраняется в файл из config.json (ключ "session").
"""
import asyncio
import os
import sys
import time

import qrcode

from ub_common import BASE, load_config, client_from_config, check_proxy, print_me

QR_PNG = os.path.join(BASE, 'qr.png')
QR_URL = os.path.join(BASE, 'qr_url.txt')


def render(url):
    qrcode.make(url, box_size=12, border=3).save(QR_PNG)
    with open(QR_URL, 'w') as f:
        f.write(url)


async def qr_flow(client, qr):
    print('--- QR-ЛОГИН: открой Telegram → Настройки → Устройства →')
    print('--- «Подключить устройство» и сканируй qr.png')
    deadline = time.time() + 15 * 60
    n = 0
    while time.time() < deadline:
        n += 1
        render(qr.url)
        print(f'QR #{n} обновлён {time.strftime("%H:%M:%S")}, '
              f'действует ~25 сек; ссылка: {qr.url}', flush=True)
        try:
            await qr.wait(timeout=25)
            break
        except asyncio.TimeoutError:
            await qr.recreate()
            continue
    else:
        print('15 минут истекли — запусти снова')
        return False
    me = await client.get_me()
    print('УСПЕХ: авторизован')
    print_me(me)
    return True


async def phone_flow(client, phone):
    if await client.is_user_authorized():
        me = await client.get_me()
        print('УЖЕ АВТОРИЗОВАН:')
        print_me(me)
        return True
    print(f'Отправляю код на +{phone} ...')
    sent = await client.send_code_request(phone)
    code = input('Код из Telegram/SMS: ').strip()
    try:
        await client.sign_in(phone=phone, code=code,
                             phone_code_hash=sent.phone_code_hash)
    except Exception as e:
        type_name = type(e).__name__
        if 'SessionPasswordNeeded' in type_name:
            pw = input('У аккаунта облачный пароль (2FA). Введи его: ')
            await client.sign_in(password=pw)
        else:
            raise
    me = await client.get_me()
    print('УСПЕХ: авторизован')
    print_me(me)
    return True


async def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'qr'
    cfg = load_config()
    ok, msg = check_proxy(cfg)
    print('прокси  :', 'OK —', msg if ok else msg)
    if not ok:
        print('СНАЧАЛА почини прокси (proxy.py) — логин через прямое '
              'подключение собьёт гео аккаунта')
        sys.exit(1)
    client = client_from_config(cfg)
    await client.connect()
    try:
        if mode == 'status':
            if await client.is_user_authorized():
                me = await client.get_me()
                print('СЕССИЯ АКТИВНА:')
                print_me(me)
            else:
                print('СЕССИИ НЕТ — нужен логин (qr или phone)')
        elif mode == 'phone':
            phone = cfg.get('phone') or input('Телефон в формате 79991234567: ')
            await phone_flow(client, phone)
        else:
            if await client.is_user_authorized():
                me = await client.get_me()
                print('УЖЕ АВТОРИЗОВАН — повторный логин не нужен:')
                print_me(me)
                return
            qr = await client.qr_login()
            await qr_flow(client, qr)
    finally:
        await client.disconnect()


if __name__ == '__main__':
    asyncio.run(main())
