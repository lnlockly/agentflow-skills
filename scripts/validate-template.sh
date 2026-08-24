#!/usr/bin/env bash
# validate-template.sh — structural check of a template skill before publish.
#
# Confirms the THIN outer template.yaml parses and carries the fields the
# vitrine + installer need, that id matches the folder, and that the guts a
# template must ship (SKILL.md, SOUL, an idempotent-looking setup.sh) exist.
# It does NOT build your guts — that's the "prove before publish" step you run
# yourself (tsc / prisma db push / a real render).
#
# Usage:
#   scripts/validate-template.sh <id>     # one template
#   scripts/validate-template.sh          # every skills/*/template.yaml
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILLS_DIR="$REPO_ROOT/skills"

PY="$(command -v python3 || command -v python || true)"
[ -n "$PY" ] || { echo "ERROR: python3 required for YAML validation" >&2; exit 2; }

validate_one() {
  local dir="$1" id yaml
  id="$(basename "$dir")"
  yaml="$dir/template.yaml"
  if [ ! -f "$yaml" ]; then
    echo "SKIP  $id (no template.yaml)"; return 0
  fi
  "$PY" - "$dir" "$id" <<'PY'
import sys, os
d, folder = sys.argv[1], sys.argv[2]
errs, warns = [], []
try:
    import yaml
except Exception as e:
    print(f"FAIL  {folder}: pyyaml not available ({e})"); sys.exit(1)
try:
    with open(os.path.join(d, "template.yaml")) as f:
        m = yaml.safe_load(f)
except Exception as e:
    print(f"FAIL  {folder}: template.yaml does not parse: {e}"); sys.exit(1)
if not isinstance(m, dict):
    print(f"FAIL  {folder}: template.yaml is not a mapping"); sys.exit(1)

def req(cond, msg):
    if not cond: errs.append(msg)

# --- required top-level scalars ---
for k in ("id", "name", "tagline", "category", "tier", "model"):
    req(m.get(k) not in (None, ""), f"missing/empty: {k}")
req(m.get("id") == folder, f"id '{m.get('id')}' must equal folder name '{folder}'")
req(m.get("tier") in ("free", "premium"), f"tier must be free|premium (got {m.get('tier')!r})")

# --- resources ---
res = m.get("resources") or {}
req(isinstance(res, dict) and isinstance(res.get("memMb"), int) and res["memMb"] > 0,
    "resources.memMb must be a positive int")

# --- install ---
inst = m.get("install") or {}
req(isinstance(inst, dict), "install must be a mapping")
skills = inst.get("skills")
req(isinstance(skills, list) and len(skills) > 0, "install.skills must be a non-empty list")
if isinstance(skills, list):
    req(any(str(s).rstrip("/").endswith("/"+folder) for s in skills),
        f"install.skills should include this skill (…/skills/{folder})")
req(inst.get("setup"), "install.setup must name a setup script (e.g. setup.sh)")
setup_name = inst.get("setup") or "setup.sh"
if inst.get("mcp") not in (None, []):
    req(isinstance(inst["mcp"], list), "install.mcp must be a list")
    for e in inst["mcp"] or []:
        req(isinstance(e, dict) and e.get("name") and e.get("install"),
            "each install.mcp entry needs name + install")

# --- onboarding ---
onb = m.get("onboarding") or {}
req(isinstance(onb, dict), "onboarding must be a mapping")
req(onb.get("greeting"), "onboarding.greeting is required")
req(isinstance(onb.get("can_do"), list) and len(onb.get("can_do") or []) > 0,
    "onboarding.can_do must be a non-empty list")

# --- showcase ---
sc = m.get("showcase") or {}
req(isinstance(sc, dict), "showcase must be a mapping")
req(isinstance(sc.get("price"), (int, float)), "showcase.price must be a number")

# --- unreplaced scaffold placeholders ---
import io
raw = open(os.path.join(d, "template.yaml")).read()
if "ЗАМЕНИ" in raw or "ЗАМЕНИ" in (m.get("tagline") or ""):
    warns.append("template.yaml still contains ЗАМЕНИ placeholders — fill them before publish")

# --- guts that every template ships ---
if not os.path.isfile(os.path.join(d, "SKILL.md")):
    errs.append("missing SKILL.md")
if not any(fn.startswith("SOUL") for fn in os.listdir(d)):
    warns.append("no SOUL_*.md persona file found")
sp = os.path.join(d, os.path.basename(setup_name))
if not os.path.isfile(sp):
    errs.append(f"install.setup points at {setup_name} but it is missing")
else:
    body = open(sp).read()
    if ".setup-done" not in body and "LATCH" not in body:
        warns.append("setup.sh has no visible latch (.setup-done) — is it idempotent?")

for w in warns: print(f"WARN  {folder}: {w}")
if errs:
    for e in errs: print(f"FAIL  {folder}: {e}")
    sys.exit(1)
print(f"PASS  {folder}")
PY
}

rc=0
if [ $# -ge 1 ]; then
  validate_one "$SKILLS_DIR/$1" || rc=1
else
  found=0
  for d in "$SKILLS_DIR"/*/; do
    [ -f "$d/template.yaml" ] || continue
    found=1
    validate_one "${d%/}" || rc=1
  done
  [ "$found" = 1 ] || { echo "no templates found under $SKILLS_DIR"; exit 0; }
fi
exit $rc
