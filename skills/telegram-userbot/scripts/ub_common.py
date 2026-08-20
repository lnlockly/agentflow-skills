#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Управление Telegram-аккаунтом (userbot) через резидентный прокси.
Общие функции: конфиг, клиент с прокси, проверка прокси, кто я.
"""
import asyncio
import json
import os
import subprocess
import sys

from telethon import TelegramClient

BASE = os.path.dirname(os.path.abspath(__file__))
CONFIG = os.path.join(BASE, 'config.json')


def load_config():
    """Читает config.json. Если нет — создаёт шаблон и выходит с подсказкой."""
    if not os.path.exists(CONFIG):
        template = {
            "api_id": 0,
            "api_hash": "",
            "session": os.path.join(BASE, "userbot"),
            "country": "kz",
            "proxy": None
        }
        with open(CONFIG, 'w') as f:
            json.dump(template, f, indent=2, ensure_ascii=False)
        print("Создан шаблон config.json — заполни api_id/api_hash "
              "(my.telegram.org → API development tools)")
        sys.exit(1)
    with open(CONFIG) as f:
        return json.load(f)


def save_config(cfg):
    with open(CONFIG, 'w') as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)


def client_from_config(cfg=None):
    """TelegramClient с прокси из конфига (или без, если proxy = None)."""
    cfg = cfg or load_config()
    proxy = cfg.get('proxy')
    return TelegramClient(
        cfg['session'], cfg['api_id'], cfg['api_hash'],
        proxy=tuple(proxy) if proxy else None)


def check_proxy(cfg):
    """Проверяет SOCKS5-прокси через curl. Возвращает (ok, строка-отчёт)."""
    p = cfg.get('proxy')
    if not p:
        return False, 'прокси не задан в config.json'
    # формат python-socks: [тип, хост, порт, rdns, логин, пароль]
    _, host, port, _, user, password = p
    url = f"socks5h://{user}:{password}@{host}:{port}"
    try:
        out = subprocess.run(
            ['curl', '-s', '--max-time', '20', '-x', url,
             'http://ip-api.com/json/?fields=country,city,query'],
            capture_output=True, text=True, timeout=25).stdout.strip()
        info = json.loads(out)
        return True, (f"{info.get('country')} / {info.get('city')} / "
                      f"IP {info.get('query')}")
    except Exception as e:
        return False, f'прокси {host}:{port} недоступен: {e}'


def print_me(me):
    print('аккаунт :', me.first_name, me.last_name or '')
    print('username:', '@' + me.username if me.username else '—')
    print('phone   : +' + str(me.phone))
    print('id      :', me.id)


async def main_whoami():
    cfg = load_config()
    ok, msg = check_proxy(cfg)
    print('прокси  :', 'OK —', msg if ok else msg)
    client = client_from_config(cfg)
    await client.connect()
    if not await client.is_user_authorized():
        print('СЕССИЯ НЕ АКТИВНА — сначала запускай qr_login.py')
        await client.disconnect()
        sys.exit(2)
    me = await client.get_me()
    print_me(me)
    await client.disconnect()


if __name__ == '__main__':
    asyncio.run(main_whoami())
