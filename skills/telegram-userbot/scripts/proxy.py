#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Управление прокси для аккаунта:
  proxy.py lease [kz]     — арендовать sticky-прокси страны (по умолчанию kz)
  proxy.py check          — проверить текущий прокси из config.json
  proxy.py renew          — перевыпустить (освободить старый + новый)
  proxy.py release        — освободить прокси (сессия остаётся)
Аренда идёт через переменные окружения PROXY_URL / PROXY_TOKEN / PROXY_USER_ID.
"""
import json
import os
import subprocess
import sys
import urllib.request

from ub_common import load_config, save_config, check_proxy

ENV_URL = os.environ.get('PROXY_URL')
ENV_TOKEN = os.environ.get('PROXY_TOKEN')
ENV_USER = os.environ.get('PROXY_USER_ID')


def lease_api_available():
    if ENV_URL and ENV_TOKEN and ENV_USER:
        return True
    print('Аренда недоступна: нет PROXY_URL / PROXY_TOKEN / PROXY_USER_ID.')
    print('Впиши свой SOCKS5-прокси в config.json вручную:')
    print('  "proxy": ["socks5", "хост", порт, true, "логин", "пароль"]')
    return False


def api(path, payload):
    req = urllib.request.Request(
        ENV_URL + path,
        data=json.dumps(payload).encode(),
        headers={'Authorization': 'Bearer ' + ENV_TOKEN,
                 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def curl_geo(proxy_url):
    out = subprocess.run(
        ['curl', '-s', '--max-time', '20', '-x', proxy_url,
         'http://ip-api.com/json/?fields=country,city,query'],
        capture_output=True, text=True, timeout=25).stdout.strip()
    return json.loads(out)


def fmt_lease(l):
    return (f"{l['country'].upper()} {l['host']}:{l['socksPort']} "
            f"(lease {l['leaseId']})")


def do_lease(country):
    cfg = load_config()
    old_lid = cfg.get('proxy_lease_id')
    l = api('/lease', {'userId': ENV_USER, 'country': country, 'sticky': True})
    if old_lid and old_lid != l['leaseId']:
        try:
            api('/release', {'leaseId': old_lid})
        except Exception:
            pass
    cfg['proxy'] = ['socks5', l['host'], l['socksPort'], True,
                    l['username'], l['password']]
    cfg['proxy_lease_id'] = l['leaseId']
    cfg['country'] = l['country']
    save_config(cfg)
    url = f"socks5h://{l['username']}:{l['password']}@{l['host']}:{l['socksPort']}"
    print('арендован:', fmt_lease(l))
    try:
        print('гео:', curl_geo(url))
    except Exception as e:
        print('гео-проверка не удалась (узел может быть мёртв):', e)
        print('→ запусти proxy.py renew, чтобы взять другой IP')
    print('сохранено в config.json')


def do_check():
    cfg = load_config()
    ok, msg = check_proxy(cfg)
    print('прокси:', 'OK —' if ok else 'ПРОБЛЕМА —', msg)


def do_renew():
    cfg = load_config()
    lid = cfg.get('proxy_lease_id')
    if lid:
        try:
            api('/release', {'leaseId': lid})
            print('освобождён старый lease', lid)
        except Exception as e:
            print('release старого не удался:', e)
    do_lease(cfg.get('country') or 'kz')


def do_release():
    cfg = load_config()
    lid = cfg.get('proxy_lease_id')
    if not lid:
        print('в конфиге нет leaseId — освобождать нечего')
        return
    api('/release', {'leaseId': lid})
    cfg['proxy'] = None
    cfg['proxy_lease_id'] = None
    save_config(cfg)
    print('прокси освобождён, из config.json убран')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'check'
    country = sys.argv[2] if len(sys.argv) > 2 else 'kz'
    if cmd == 'lease' or cmd == 'renew':
        if not lease_api_available():
            sys.exit(1)
    if cmd == 'lease':
        do_lease(country)
    elif cmd == 'renew':
        do_renew()
    elif cmd == 'release':
        do_release()
    else:
        do_check()
