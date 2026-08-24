---
name: how-to-build-agents
description: The canonical AgentFlow method for building a great agent or template — dynamic, tool-based, memory-personalized. Use when creating or improving any agent/template, or when deciding how to structure an agent's capabilities.
---

# How to build an AgentFlow agent

An agent is **dynamic**: it reasons, proposes a plan, adapts to the user *and* the
content, and remembers tastes. Your job when building one is to give it **tools**
and **guidance** — never to hardcode its behavior in a rigid script.

## The anti-pattern (do NOT do this)
A monolithic script that, on any input, does one fixed thing — no plan, no
question, no memory. (Real mistake: a video script that always produced a serious
"разбор" even on a comedy meme.) That is a **conveyor, not an agent.** It kills the
one thing that makes agents valuable: adapting to the user.

## The 3-layer pattern (do THIS)

**1. Tools = the hands.** Expose each capability as a discrete, single-purpose,
composable **MCP tool** (e.g. `transcribe`, `face_crop`, `generate_image`,
`render`, `send`). Deterministic. Delivered per-agent as a stdio-MCP server the
agent installs from a hub. The agent *calls* tools; it never runs a black box.

**2. Skill = the brain-guidance (thin).** A SKILL.md that describes **how to
orchestrate** the tools and the interaction pattern — taste and examples, NOT
rails:
- Understand the user's intent and the content.
- **Propose a plan / confirm** before heavy work — never blindly execute on the
  first message.
- **Recall the user's saved preferences** and default to them.
- **Pick the approach that fits the content** (a meme is not a documentary).
- Orchestrate the tools to produce it.
- Deliver in the right format.
Templates are **examples/starting points** the user can fork, tweak, or replace
with their own — even several.

**3. Memory = personalization (the moat).** Remember the user's brand, style,
handles, and defaults; apply them automatically next time; let the user **save
their own templates** ("remember this as my style"). A returning user gets their
look with zero re-explaining.

## Hard rules
- **Plan before heavy work.** Offer a plan; don't assume.
- **Match approach to content.** Don't force one template on everything.
- **Long/heavy work runs ASYNC.** A chat turn expects fast tool calls — a
  multi-minute render must run in the background and deliver when done, never
  block the turn.
- **Correct output format.** (e.g. a vertical reel is a proper 9:16 *video*, not a
  square or a document.)
- **Everything dynamic on volumes.** The user can open, edit, and extend the
  agent's tools, skills, and templates at runtime — no image rebuild.

## When you build or improve an agent
1. List the capabilities → make each an MCP tool.
2. Write a THIN skill that guides orchestration + the plan→confirm→recall→produce
   loop.
3. Wire memory for the user's preferences + custom templates.
4. Make heavy steps async with delivery-on-completion.
5. Ship examples (templates) the user can fork — not rails.
