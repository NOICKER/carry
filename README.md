# CArrY

> Every other solution requires you to do the work yourself. 
CArrY does it automatically — one command, zero manual effort.

---

## The Problem

Free AI coding tiers run out. You switch from Claude to ChatGPT to Gemini and back again — and every time you do, the new AI has no idea what you were building. You paste files, re-explain your project, and waste half your quota just getting the AI back up to speed.

**CArrY fixes that.**

---

## What It Does

Run one command inside any project folder:

```bash
npx carry-handoff
```

CArrY will:

1. **Read your project** — walks your entire codebase, understands its structure
2. **Identify what it is** — matches against a library of real-world project patterns (music app, e-commerce, SaaS, chat app, and more)
3. **Label everything** — what's recognized gets tagged, what isn't gets flagged as miscellaneous and matched against other project types so you know what it *could* be
4. **Extract your coding style** — detects your naming conventions, formatting choices, and patterns automatically
5. **Assemble a handoff prompt** — one clean, copy-paste ready block that gives any AI full context on your project instantly

---

## Example Output

```
CArrY v1.0.0

Scanning project...

Project identified: Music Streaming App (81% match)
  Also resembles: Social App (44%), SaaS Dashboard (29%)

Labeled: 1,043 lines across 14 files
Miscellaneous: 287 lines
  └─ Looks like payment logic — similar to e-commerce patterns

Style snapshot:
  camelCase · ES modules · Arrow functions · Async/await · No semicolons · 2 spaces

─────────────────────────────────────────────
HANDOFF PROMPT (saved to carry-output.txt)
─────────────────────────────────────────────

You are continuing a coding session. This is a Music Streaming App built
with React and Node.js. It includes a player module, playlist management,
and a user auth system. Code style: camelCase, ES modules, arrow functions,
async/await, no semicolons, 2-space indentation. Previously I was working
on: [your last message here]. Continue from here.
```

---

## Why CArrY Exists

Most AI coding tools assume you have money for subscriptions or API keys. CArrY assumes you don't. It's built for:

- **Vibe coders** who build fast and switch AIs often
- **Developers in regions** where AI subscription costs are prohibitive
- **Anyone** who's ever lost context switching between Claude, ChatGPT, and Gemini

No API keys. No account. No cost. Just one command.

---

## Installation

No installation needed. Just run:

```bash
npx carry-handoff
```

Or install globally if you use it often:

```bash
npm install -g carry-handoff
```

---

## How the Handoff Works

CArrY generates a handoff prompt from three things it already has:

- Your **project summary** (what it identified)
- Your **style snapshot** (how your code is written)
- Your **last message** (what you ask CArrY when you run it)

No AI calls. No quota burned. Pure code analysis.

---

## Project Pattern Library

CArrY matches your project against a library built from thousands of real open source repos on GitHub. Currently supported project types:

| Type | Examples |
|------|---------|
| Music Streaming App | Spotify clones, audio players |
| E-Commerce | Shopping carts, product catalogs |
| SaaS Dashboard | Admin panels, analytics tools |
| Chat App | Messaging, real-time communication |
| Portfolio | Personal sites, showcases |

More types are added regularly. Don't see yours? [Open an issue](../../issues) or contribute a pattern.

---

## Contributing

CArrY is open source and built to grow. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add new project patterns, improve the matcher, or suggest features.

---

## License

MIT — do whatever you want with it.

---

*Built for the people who build with vibes.*
