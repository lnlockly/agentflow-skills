# Contributing a Template

A **template** is a sellable AgentFlow agent, packaged as one hub skill under
`skills/<id>/`. The vitrine installs it, the pod prewarms it, and a user gets a
working agent. This is the whole recipe — short and practical.

## Anatomy: a thin skin over free-form guts

```
skills/<id>/
├── template.yaml     # THIN outer manifest — metadata + POINTERS only
├── SKILL.md          # the method the agent follows (points at the guts)
├── SOUL_<ID>.md      # persona / tone
├── setup.sh          # idempotent + latched prewarm, run once in the pod
├── assets/           # showcase media (cover.jpg, demo.mp4) — committed
└── <your guts>       # ANY free-form code: boilerplate/, a render project,
                      # mcp-server.mjs, prompt files… no fixed layout
```

The split is the whole point:

- **`template.yaml` is thin and boring.** It carries only what the platform
  needs — id, name, category, resources, what to `install`, the onboarding
  copy, the vitrine `showcase`. It **never** describes how the guts work. It is
  validated against the manifest shape, so keep it small and honest.
- **The guts are free-form.** Whatever the agent actually needs lives in the
  folder in whatever shape fits — a `boilerplate/` to copy per user, a proven
  Remotion project, prompts, an MCP server. `SKILL.md` is the method that
  drives them; `setup.sh` warms them.

Two shipped templates show the range: **video-producer** (8 GB, a Remotion
render project + an MCP server) and **bot-builder** (2 GB, a grammY+Prisma
`boilerplate/` it copies per bot, no MCP). Same thin manifest, totally
different guts. Read them before writing your own.

## The 5-step recipe

```bash
# 1. SCAFFOLD — one command, every file filled + cross-referenced
scripts/new-template.sh --id resume-builder --name "Строитель резюме" --category docs
#   (or run it with no args for interactive prompts)

# 2. ADD GUTS — drop your code into skills/resume-builder/ and fill the ЗАМЕНИ
#    fields in SKILL.md, SOUL_*.md, template.yaml. Guts can be any shape.

# 3. SETUP.SH — make it actually prewarm the guts (npm install, pip, prisma
#    generate…). Add a real second latch condition proving warmth, e.g.
#      [ -f "$LATCH" ] && [ -d node_modules/<pkg> ]

# 4. VALIDATE — structural check of the thin manifest + required files
scripts/validate-template.sh resume-builder      # must print PASS

# 5. PUBLISH
git add skills/resume-builder
git commit -m "resume-builder: new template"
git push
```

## Test it locally

- **setup.sh must be idempotent + latched.** Run it twice: the first run does
  the work, the second prints `already done` in a second. The pod persists
  `/usr /opt /root` on the data PVC, so deps are paid for once per agent — never
  redo heavy work on a warm latch. Guard optional/best-effort steps with
  `|| true` so a soft failure can **never** break the latch or the run.
- **Exercise the guts the way the agent will.** Copy the `boilerplate/`, run its
  install, hit its entrypoint. Bundle a render. Whatever the skill claims to do,
  do it once by hand from a clean checkout.
- `scripts/validate-template.sh <id>` catches the cheap mistakes (unparseable
  YAML, missing fields, id≠folder, missing `setup.sh`, leftover `ЗАМЕНИ`
  placeholders). It does **not** build your guts — that is step 4 below.

## Prove before publish (the one hard rule)

**Do not publish a template until its guts have really run.** The manifest
passing validation proves nothing about whether the agent works. Before you
push:

- **bot-builder-style guts:** `tsc` builds clean **and** `prisma db push`
  succeeds against a scratch DB.
- **video-producer-style guts:** a real render completes end-to-end and produces
  an MP4 (the proven project already did — 62 s for a 12 s reel).
- **anything else:** run the actual thing once, from a clean pod, and see the
  output.

A template that installs but doesn't deliver is worse than no template. Prove
it, then ship it.
