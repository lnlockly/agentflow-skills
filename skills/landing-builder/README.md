# Строитель лендингов (`landing-builder`)

AgentFlow template skill. Anatomy:

| File / dir        | Role                                                        |
|-------------------|-------------------------------------------------------------|
| `template.yaml`   | THIN outer manifest — metadata + pointers. Keep it small.   |
| `SKILL.md`        | The method the agent follows. Points at the guts.           |
| `SOUL_LANDING_BUILDER.md` | Persona / tone.                                    |
| `setup.sh`        | Idempotent+latched prewarm, run once in the pod.            |
| `assets/`         | Showcase media (cover, demos) — committed.                  |
| **your guts**     | ADD HERE — any free-form code/boilerplate/render project.   |

## Add the guts
Put whatever this template actually needs right in this folder — a `boilerplate/`
to copy, a render project, prompt files, an `mcp-server.mjs`. No fixed layout:
the manifest is thin on purpose so the guts can be anything. Then wire them up:

1. Reference them from `SKILL.md` (how the agent runs them).
2. Prewarm them in `setup.sh` (install deps, generate clients) and add a
   second latch condition proving they are warm.
3. If you ship an MCP server, add it under `install.mcp` in `template.yaml`.

## Prove before publish
- Run `bash setup.sh` in a clean pod — it must succeed and be idempotent (2nd
  run prints "already done").
- Actually exercise the guts (tsc builds / prisma db push / a render completes).
- `scripts/validate-template.sh landing-builder` must pass.

See `../../CONTRIBUTING-TEMPLATES.md` for the full recipe.
