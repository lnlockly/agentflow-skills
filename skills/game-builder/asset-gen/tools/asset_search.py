#!/usr/bin/env python3
"""
asset_search.py — find FREE game assets before paying to generate. Searches CC0 /
permissive hubs and downloads with the licence recorded, so the README asset table
can carry attribution.

  # CC0 PBR textures (ambientCG — no key)
  python3 asset_search.py texture --query wood --download -o src/assets/tex
  # low-poly 3D models (Poly Pizza — free key in POLY_PIZZA_KEY)
  python3 asset_search.py model   --query car  --download -o src/assets/glb

Sources (all free; prefer these over generation):
  ambientCG   CC0 PBR textures/materials        no key
  Poly Pizza  CC0/CC-BY low-poly GLB models      POLY_PIZZA_KEY (free: poly.pizza/api)
  (curated, no search API — see SKILL.md: Kenney CC0 packs, OpenGameArt, Quaternius)

Prints JSON to stdout: {"ok":true, "results":[{name,license,attribution,url,path?}]}.
"""
import sys, os, json, argparse, urllib.request, urllib.parse, zipfile, io

UA = {"User-Agent": "agentflow-game-builder/1.0"}

def _get(url, headers=None):
    req = urllib.request.Request(url, headers={**UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read()

def search_ambientcg(query, limit):
    q = urllib.parse.urlencode({"type": "Material", "limit": limit, "q": query, "sort": "Popular"})
    data = json.loads(_get(f"https://ambientcg.com/api/v2/full_json?{q}"))
    out = []
    for a in data.get("foundAssets", []):
        aid = a.get("assetId")
        out.append({"source": "ambientCG", "name": aid, "license": "CC0",
                    "attribution": "ambientCG (CC0, no attribution required)",
                    "tags": (a.get("tags") or [])[:6],
                    # stable direct-download pattern, 1K JPG PBR set
                    "url": f"https://ambientcg.com/get?file={aid}_1K-JPG.zip"})
    return out

def search_polypizza(query, limit):
    key = os.environ.get("POLY_PIZZA_KEY")
    if not key:
        return {"error": "POLY_PIZZA_KEY not set — get a free key at poly.pizza/api"}
    data = json.loads(_get(f"https://api.poly.pizza/v1.1/search/{urllib.parse.quote(query)}?limit={limit}",
                           headers={"x-auth-token": key}))
    out = []
    for m in data.get("results", [])[:limit]:
        out.append({"source": "Poly Pizza", "name": m.get("Title"),
                    "license": m.get("licence") or "CC-BY",
                    "attribution": f'{m.get("Title")} by {(m.get("Creator") or {}).get("Username","?")} (Poly Pizza)',
                    "url": m.get("Download") or m.get("Thumbnail")})
    return out

def download(item, outdir):
    os.makedirs(outdir, exist_ok=True)
    raw = _get(item["url"])
    if item["url"].endswith(".zip") or raw[:2] == b"PK":
        # textures come zipped — extract the image files
        z = zipfile.ZipFile(io.BytesIO(raw))
        names = [n for n in z.namelist() if n.lower().endswith((".jpg", ".png", ".jpeg"))]
        base = os.path.join(outdir, item["name"])
        os.makedirs(base, exist_ok=True)
        for n in names:
            z.extract(n, base)
        return base
    ext = ".glb" if raw[:4] == b"glTF" or item["url"].lower().endswith(".glb") else ".bin"
    path = os.path.join(outdir, item["name"].replace(" ", "_") + ext)
    open(path, "wb").write(raw)
    return path

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("kind", choices=["texture", "model"])
    ap.add_argument("--query", required=True)
    ap.add_argument("--limit", type=int, default=6)
    ap.add_argument("--download", action="store_true")
    ap.add_argument("-o", "--out", default="src/assets/free")
    a = ap.parse_args()
    try:
        res = search_ambientcg(a.query, a.limit) if a.kind == "texture" else search_polypizza(a.query, a.limit)
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)[:200]})); return 1
    if isinstance(res, dict) and res.get("error"):
        print(json.dumps({"ok": False, **res})); return 1
    if a.download:
        for item in res:
            try: item["path"] = download(item, a.out)
            except Exception as e: item["download_error"] = str(e)[:120]
    print(json.dumps({"ok": True, "count": len(res), "results": res}, ensure_ascii=False, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
