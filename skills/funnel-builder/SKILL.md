---
name: funnel-builder
description: "Design a Telegram-bot sales funnel as a message sequence AND render it as a beautiful interactive node-graph HTML flow-canvas (message screens with buttons, curved SVG connectors, branches, light/dark)."
version: 1.0.0
author: AgentFlow
license: MIT
platforms: [linux, macos]
metadata:
  hermes:
    tags: [funnel, sales, telegram, bot, flow, diagram, canvas, svg, marketing, воронка, продажи]
    related_skills: [bot-builder, publish]
---

# Funnel Builder — Sales Funnels as Message Sequences + Visual Flow-Canvas

You design a Telegram-bot SALES FUNNEL in two artifacts that stay in sync:

1. A **message sequence** — the exact screens a user walks through, with the
   buttons that branch them.
2. A **self-contained HTML flow-canvas** — a node-graph where every node is a
   message screen and every button is wired by a curved SVG connector to the
   next screen.

Use your file and code tools only. Nothing here calls an external service.

---

## Part 1 — Write the message sequence

A funnel is an ordered path with branches. Follow this proven skeleton and
adapt the copy to the user's product:

1. **Hook** — one line that names the visitor's pain or desire. Ends with a
   single primary button ("Yes, that's me →").
2. **Value** — 2-4 short lines proving you can solve it (a mechanism, a result,
   a mini-case). Button: "How it works".
3. **CTA** — the concrete ask (book a call, start trial, get the checklist).
   Two buttons: primary action + "I have a question".
4. **Nurture** — for people not ready. A soft-touch screen (free lesson, social
   proof, FAQ) that loops back to the CTA. Reached from "I have a question" or
   "Not now".
5. **Tariffs** — the offer table. One node per plan or one node listing all
   plans as buttons; each plan button leads to a checkout/confirmation screen.

Rules for good funnel copy:

- One idea per screen. If a screen needs scrolling, split it.
- Every screen has at least one button; a screen with no button is a dead end.
- Name buttons as the user's next thought, not as a command.
- Branches must reconverge — a "question" branch returns to CTA or Tariffs.
- Track the single **critical path** (Hook → Value → CTA → Tariffs → checkout)
  and make sure it is always one tap forward.

Represent the funnel as a small data structure first (you will feed the same
structure to Part 2):

```json
{
  "screens": [
    { "id": "hook",   "title": "Hook",   "text": "Losing leads in DMs?",
      "buttons": [ { "label": "Yes, that's me", "to": "value" } ] },
    { "id": "value",  "title": "Value",  "text": "Our bot replies in 2s, 24/7.",
      "buttons": [ { "label": "How it works", "to": "cta" } ] },
    { "id": "cta",    "title": "CTA",    "text": "Start free — no card.",
      "buttons": [ { "label": "Start free", "to": "tariffs" },
                   { "label": "I have a question", "to": "nurture" } ] },
    { "id": "nurture","title": "Nurture","text": "Free 3-min lesson + FAQ.",
      "buttons": [ { "label": "Back to start", "to": "cta" } ] },
    { "id": "tariffs","title": "Tariffs","text": "Pick a plan:",
      "buttons": [ { "label": "Starter $19", "to": "checkout" },
                   { "label": "Pro $49", "to": "checkout" } ] },
    { "id": "checkout","title":"Checkout","text": "Great! Confirm your plan.",
      "buttons": [] }
  ]
}
```

Save this as `funnel.json` in the workspace. It is the source of truth; when
you hand off to `bot-builder`, the same screens/buttons become handlers.

---

## Part 2 — Render the flow-canvas (self-contained HTML)

Build a single `funnel.html` file. It must open with no network, no build step,
no CDN. The connectors are the point: draw them with **JS after layout** using
`getBoundingClientRect()`, so a line starts at the exact button and ends at the
target screen's header — this survives any layout, zoom, or theme.

### Structure

- A `#canvas` positioned-relative container holds all nodes.
- Each screen is an absolutely-positioned `.node` card: a header (title), a body
  (text), and a stack of `.btn` elements. Give each node `data-id` and each
  button `data-to` (the target screen id).
- One full-canvas `<svg id="wires">` sits **behind** the nodes
  (`z-index` lower), sized to the canvas, holding one `<path>` per button→target.

### Connector drawing (the load-bearing part)

```js
function layoutWires() {
  const canvas = document.getElementById('canvas');
  const svg = document.getElementById('wires');
  const cr = canvas.getBoundingClientRect();
  svg.setAttribute('width', canvas.scrollWidth);
  svg.setAttribute('height', canvas.scrollHeight);
  svg.innerHTML = '';
  document.querySelectorAll('.btn[data-to]').forEach(btn => {
    const target = document.querySelector(`.node[data-id="${btn.dataset.to}"]`);
    if (!target) return;
    const b = btn.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    // start at right edge of the button, end at left edge of target header
    const x1 = b.right - cr.left, y1 = b.top - cr.top + b.height / 2;
    const x2 = t.left  - cr.left, y2 = t.top - cr.top + 24;
    const dx = Math.max(40, Math.abs(x2 - x1) * 0.5); // curve tension
    const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', 'var(--wire)');
    p.setAttribute('stroke-width', '2');
    p.setAttribute('marker-end', 'url(#arrow)');
    svg.appendChild(p);
  });
}
window.addEventListener('load', layoutWires);
window.addEventListener('resize', layoutWires);
```

- Define an `<marker id="arrow">` (a small triangle) in `<defs>` for the arrowhead.
- Call `layoutWires()` again whenever a node is dragged (optional: make nodes
  draggable with pointer events and re-run on move).
- Position nodes in columns by funnel stage (Hook, Value, CTA, Nurture, Tariffs,
  Checkout) left-to-right so branches read naturally; stack branch targets
  vertically.

### Design (make it beautiful)

- Cards: rounded 16px, soft shadow, 1px border, generous padding, ~260px wide.
- Header tinted by stage (hook=amber, value=blue, cta=green, nurture=violet,
  tariffs=rose). Buttons look like real Telegram inline buttons (pill, full
  width, subtle hover).
- **Theme-aware**: define a light palette on `:root` and override under
  `@media (prefers-color-scheme: dark)`. Wire color, card bg, text, shadow all
  come from CSS variables so the diagram is legible in both themes.
- Wrap the canvas in an `overflow: auto` viewport; never let the page body
  scroll horizontally by accident.

### Generate from the data

Loop `funnel.json` → emit one `.node` per screen and one `.btn[data-to]` per
button. Keep node ids identical to the JSON so the wires resolve. This means the
sequence (Part 1) and the visual (Part 2) can never drift.

---

## Deliverables

1. `funnel.json` — the screen/button graph (source of truth).
2. `funnel.html` — the self-contained visual flow-canvas.
3. A short written summary of the funnel path and where each branch reconverges.

To put `funnel.html` on a public URL, hand off to the `publish` skill.
To turn `funnel.json` into a running bot, hand off to `bot-builder`.
