#!/usr/bin/env bash
# new-template.sh — scaffold a new AgentFlow template skill in one command.
#
# A template = a hub skill package under skills/<id>/ with a THIN outer
# template.yaml (metadata + pointers) wrapped around FREE-FORM guts (your code,
# prompts, SKILL.md, SOUL) plus an idempotent setup.sh that prewarms it.
#
# This scaffolds the skeleton with every file filled in and cross-referenced so
# you only add the guts. It refuses to overwrite an existing skill.
#
# Usage:
#   scripts/new-template.sh --id <kebab-id> --name "<Название>" --category <cat>
#   scripts/new-template.sh <id> "<name>" <category>
#   scripts/new-template.sh            # interactive prompts
#
# Then: drop your guts into skills/<id>/, edit setup.sh, and
#   scripts/validate-template.sh <id>   # before you publish
set -euo pipefail

# --- locate the repo (this script lives in <repo>/scripts) --------------------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILLS_DIR="$REPO_ROOT/skills"

ID=""; NAME=""; CATEGORY=""
# --- args: flags first, then bare positionals ---------------------------------
while [ $# -gt 0 ]; do
  case "$1" in
    --id)       ID="${2:-}"; shift 2 ;;
    --name)     NAME="${2:-}"; shift 2 ;;
    --category) CATEGORY="${2:-}"; shift 2 ;;
    -h|--help)
      sed -n '2,20p' "$0"; exit 0 ;;
    -*)
      echo "unknown flag: $1" >&2; exit 2 ;;
    *)
      if   [ -z "$ID" ];       then ID="$1"
      elif [ -z "$NAME" ];     then NAME="$1"
      elif [ -z "$CATEGORY" ]; then CATEGORY="$1"
      else echo "too many args: $1" >&2; exit 2
      fi
      shift ;;
  esac
done

# --- interactive fallback for anything still missing --------------------------
prompt() { # prompt <var-echo-label> ; reads into REPLY
  local label="$1" val=""
  read -r -p "$label" val </dev/tty || true
  printf '%s' "$val"
}
if [ -t 0 ]; then
  [ -z "$ID" ]       && ID="$(prompt 'Template id (kebab-case, e.g. resume-builder): ')"
  [ -z "$NAME" ]     && NAME="$(prompt 'Display name (RU ok, e.g. Строитель резюме): ')"
  [ -z "$CATEGORY" ] && CATEGORY="$(prompt 'Category (e.g. bots, video, docs, growth): ')"
fi

# --- validate inputs ----------------------------------------------------------
[ -n "$ID" ]       || { echo "ERROR: id is required (--id or positional)"       >&2; exit 2; }
[ -n "$NAME" ]     || { echo "ERROR: name is required (--name or positional)"   >&2; exit 2; }
[ -n "$CATEGORY" ] || { echo "ERROR: category is required (--category or arg)"  >&2; exit 2; }
if ! printf '%s' "$ID" | grep -Eq '^[a-z][a-z0-9-]*[a-z0-9]$'; then
  echo "ERROR: id '$ID' must be kebab-case: lowercase letters/digits/hyphens, e.g. resume-builder" >&2
  exit 2
fi
DEST="$SKILLS_DIR/$ID"
if [ -e "$DEST" ]; then
  echo "ERROR: skills/$ID already exists — pick another id or edit it directly." >&2
  exit 1
fi

# SOUL filename suffix: UPPER, hyphens -> underscores
SOUL_SUFFIX="$(printf '%s' "$ID" | tr 'a-z-' 'A-Z_')"
SOUL_FILE="SOUL_${SOUL_SUFFIX}.md"

echo "Scaffolding template '$ID' ($NAME) in category '$CATEGORY'…"
mkdir -p "$DEST/assets"

# --- template.yaml (THIN outer manifest — filled, ready to trim) --------------
cat > "$DEST/template.yaml" <<YAML
# AgentFlow template manifest — THIN OUTER lifecycle contract.
# Metadata + POINTERS only. It never describes the guts (your code, prompts,
# setup.sh internals). Keep it small. Validate: scripts/validate-template.sh $ID
id: $ID
name: $NAME
tagline: ЗАМЕНИ — одна строка от лица пользователя, что он получит.
category: $CATEGORY
tier: premium            # free | premium
model: gpt-5.5

resources:
  memMb: 2048            # bump for heavy work (video ≈ 8192); add cpus: N if needed

install:
  skills:
    - lnlockly/agentflow-skills/skills/$ID
    # - lnlockly/agentflow-skills/skills/publish   # add helper skills as needed
  mcp: []               # add { name, install } entries if this template ships an MCP server
  setup: setup.sh        # runs once in the pod to prewarm the guts

onboarding:
  greeting: |
    ЗАМЕНИ — тёплое первое сообщение агента: кто он и что сделает для юзера.
  can_do:
    - ЗАМЕНИ — что умеет, пункт 1
    - ЗАМЕНИ — что умеет, пункт 2
  examples:
    - "ЗАМЕНИ — пример реплики юзера, с которой начинается работа"

config:
  - key: example
    label: Пример настройки
    type: text            # text | number | bool | select (+ options: [...])

showcase:
  cover: assets/cover.jpg   # drop a real cover into assets/
  demos: []                 # assets/demo.mp4, assets/screenshot.png, …
  price: 900
YAML

# --- SKILL.md (the method — free-form guts entrypoint) ------------------------
cat > "$DEST/SKILL.md" <<MD
---
name: $ID
description: ЗАМЕНИ — одно предложение: что делает и КОГДА агенту это использовать (триггер). Модель читает это, чтобы решить, включать ли навык.
---

# $NAME

ЗАМЕНИ этим весь метод. Пиши инструкцию для агента от второго лица:
что он делает, из чего собран, как запускает. Указывай на РЕАЛЬНЫЕ файлы в этой
папке (guts), а не пересказывай их.

## When to use
ЗАМЕНИ — когда именно агент включает этот навык (какое сообщение/файл от юзера).

## What ships with this skill
- \`setup.sh\` — прогрев окружения (запускается один раз в поде).
- ЗАМЕНИ — перечисли свои guts: папку с кодом / boilerplate / render-проект / промпты.

## How to run
1. ЗАМЕНИ — шаг 1 (напр. \`bash setup.sh\` если ещё не прогрето).
2. ЗАМЕНИ — шаг 2.
3. ЗАМЕНИ — отдать результат юзеру в чат.

## Remember (personalization)
ЗАМЕНИ — что запоминать про юзера (вкусы, ник, стиль) и применять по умолчанию.
MD

# --- SOUL (persona) -----------------------------------------------------------
cat > "$DEST/$SOUL_FILE" <<MD
# $NAME

ЗАМЕНИ — кто этот агент одним абзацем: роль, за кого он, что делает для юзера.

## Характер
- ЗАМЕНИ — тон (по-человечески, коротко, без канцелярита).
- ЗАМЕНИ — как ведёт себя: уверенно, не заваливает вопросами.

## Как работает
- ЗАМЕНИ — короткий цикл: получил X → сделал Y (навык \`$ID\`) → отдал результат.
- ЗАМЕНИ — что говорит, пока работает; как отдаёт готовое.

## Первое сообщение
ЗАМЕНИ — тепло представься одной-двумя фразами и дай один конкретный пример-подсказку.
MD

# --- setup.sh (idempotent + latched prewarm stub) -----------------------------
cat > "$DEST/setup.sh" <<'SH'
#!/usr/bin/env bash
# setup.sh — ONE-TIME environment prep for this skill, run inside the agent pod.
# Idempotent + latched: safe to call before every job; the heavy work runs once.
# The pod overlay-persists /usr /opt /root on the DATA PVC, so installed deps
# SURVIVE pod restarts — paid once per agent.
set -euo pipefail
cd "$(dirname "$0")"

LATCH=".setup-done"
# TODO: add a second condition proving the guts are actually warm, e.g.
#   [ -d node_modules/<pkg> ]  or  [ -f .venv/bin/python ]
if [ -f "$LATCH" ]; then
  echo "[setup] already done"
  exit 0
fi

echo "[setup] prewarming…"
# TODO: install deps for your guts here. Examples:
#   npm install --no-audit --no-fund --loglevel=error
#   python3 -m pip install --user -r requirements.txt
# Keep it non-interactive. Guard optional/best-effort steps with || true so a
# soft failure can NEVER break the latch.

touch "$LATCH"
echo "[setup] done"
SH
chmod +x "$DEST/setup.sh"

# --- .gitignore (keep the runtime latch + installed deps out of git) ----------
cat > "$DEST/.gitignore" <<'GI'
.setup-done
node_modules/
.venv/
out/
GI

# --- assets/README so the empty dir is tracked + self-documenting -------------
cat > "$DEST/assets/README.md" <<MD
# assets/

Showcase media referenced by \`template.yaml\` (\`showcase.cover\`, \`showcase.demos\`,
\`onboarding.examples\`). Drop real files here:

- \`cover.jpg\` — vitrine card cover (required for a good listing).
- \`demo.mp4\` / \`screenshot.png\` — proof it works.

Keep them small. These ARE committed (they are how the vitrine sells the template).
MD

# --- top-level README explaining where the guts go ----------------------------
cat > "$DEST/README.md" <<MD
# $NAME (\`$ID\`)

AgentFlow template skill. Anatomy:

| File / dir        | Role                                                        |
|-------------------|-------------------------------------------------------------|
| \`template.yaml\`   | THIN outer manifest — metadata + pointers. Keep it small.   |
| \`SKILL.md\`        | The method the agent follows. Points at the guts.           |
| \`$SOUL_FILE\` | Persona / tone.                                    |
| \`setup.sh\`        | Idempotent+latched prewarm, run once in the pod.            |
| \`assets/\`         | Showcase media (cover, demos) — committed.                  |
| **your guts**     | ADD HERE — any free-form code/boilerplate/render project.   |

## Add the guts
Put whatever this template actually needs right in this folder — a \`boilerplate/\`
to copy, a render project, prompt files, an \`mcp-server.mjs\`. No fixed layout:
the manifest is thin on purpose so the guts can be anything. Then wire them up:

1. Reference them from \`SKILL.md\` (how the agent runs them).
2. Prewarm them in \`setup.sh\` (install deps, generate clients) and add a
   second latch condition proving they are warm.
3. If you ship an MCP server, add it under \`install.mcp\` in \`template.yaml\`.

## Prove before publish
- Run \`bash setup.sh\` in a clean pod — it must succeed and be idempotent (2nd
  run prints "already done").
- Actually exercise the guts (tsc builds / prisma db push / a render completes).
- \`scripts/validate-template.sh $ID\` must pass.

See \`../../CONTRIBUTING-TEMPLATES.md\` for the full recipe.
MD

echo
echo "Created skills/$ID/:"
( cd "$DEST" && ls -1 && echo "  assets/" )
cat <<NEXT

Next (in <5 steps):
  1. Add your guts into skills/$ID/            (boilerplate / render project / prompts)
  2. Fill SKILL.md, $SOUL_FILE, and the ЗАМЕНИ fields in template.yaml
  3. Make setup.sh actually prewarm the guts (+ a real second latch condition)
  4. Prove it: run setup.sh (idempotent) AND exercise the guts (tsc/prisma/render)
  5. Validate + publish:
       scripts/validate-template.sh $ID
       git add skills/$ID && git commit -m "$ID: new template" && git push
NEXT
