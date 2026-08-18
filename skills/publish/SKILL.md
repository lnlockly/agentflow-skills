---
name: publish
description: "Publish a built site/app folder to a public https URL via AgentFlow's frp tunnel: run publish.py serve <dir> [name] and hand the returned https link to the user."
version: 1.0.0
author: AgentFlow
license: MIT
platforms: [linux, macos]
metadata:
  hermes:
    tags: [publish, deploy, frp, tunnel, https, hosting, url, expose, публикация, ссылка]
    related_skills: [funnel-builder, bot-builder]
---

# Publish — Put a Site/App on a Public HTTPS URL (frp tunnel)

When the user wants their built site or app reachable on the internet by a link,
publish it through AgentFlow's **frp tunnel**. A helper script, `publish.py`, is
already baked into the agent image. You do not build or configure a tunnel — you
call the script and return the URL it prints.

This is the ONLY sanctioned publish path. Do not use web-deploy, here-now, or any
other hosting mechanism.

---

## The command

```bash
python3 /opt/hermes-agent/publish.py serve <dir> [name]
```

- `<dir>` — the directory to serve. It must contain an `index.html` at its root
  (e.g. the folder holding your `funnel.html` renamed to `index.html`, or a
  built `dist/` / site folder).
- `[name]` — optional subdomain label. If given, the public URL uses it as the
  subdomain; if omitted, the script assigns one. Keep it short, lowercase,
  hyphenated (`my-funnel`, `acme-landing`).

The script prints a line like:

```
https://<sub>.<PUBLISH_BASE_DOMAIN>/
```

That is the live link. `<PUBLISH_BASE_DOMAIN>` is set in the agent's environment;
the script fills it in — you never hardcode a domain.

---

## Workflow

1. Make sure the directory you serve has `index.html` at its top level.
   - If you built `funnel.html`, either serve its folder with an `index.html`,
     or copy/rename: `cp funnel.html <dir>/index.html`.
2. Run the command:
   ```bash
   python3 /opt/hermes-agent/publish.py serve ./site my-funnel
   ```
3. Capture the printed `https://...` URL from stdout.
4. Give the user that exact URL. That is the deliverable — the link they share.

## Notes

- The serve process stays up to keep the tunnel alive; the site is live while it
  runs. Mention this to the user if they ask why the link works.
- Publish only static, self-contained output (HTML/CSS/JS, images). For a
  running bot you do not publish a folder — a polling bot needs no public URL;
  only a webhook bot does, and then you expose its port the same way and set the
  webhook to the returned URL.
- Do not invent flags the script does not have. The contract is
  `serve <dir> [name]` → prints an https URL. If the script errors, read its
  output and fix the input directory (missing `index.html` is the usual cause).

## Deliverable

The single public `https://...` link, handed to the user.
