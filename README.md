# HamLoop

**An open-source, self-hostable AI builder loop app.** HamLoop is a mobile-first app that helps you pick, build, commit, and review one small task every day.

> **One small loop a day.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ftaobuilds%2Fhamloop&env=AI_PROVIDER&envDescription=Set%20AI_PROVIDER%20to%20mock%20for%20a%20free%20demo%2C%20or%20openai%2Fanthropic%20with%20your%20own%20key&envLink=https%3A%2F%2Fgithub.com%2Ftaobuilds%2Fhamloop%2Fblob%2Fmain%2Fdocs%2Fself-hosting.md)

> The **Deploy** button clones this repo into your own Vercel project. It prompts for `AI_PROVIDER` — set it to `mock` to launch a free, key-less demo, or to `openai` / `anthropic` and add your own key for real AI. Update the `taobuilds/hamloop` URL above to point at your own fork.

Fork it, self-host it, and plug in your own AI API key. The public demo runs in **mock mode** (no real AI); real AI is something you enable on your own copy.

## Core loop

**Pick → Build → Commit → Review**

## Features

- **Today tab** — your single small loop for the day, front and center
- **Morning Swipe Planner** — swipe through candidate tasks to pick what's next
- **Build focus mode** — a calm, distraction-light space to do the work
- **Commit support** — close the loop with a real commit
- **GitHub Skill Radar** — fresh AI / agent / dev-tool repos to learn from
- **My Skill Library** — save the tools and skills you want to practice
- **Review → AI-generated tomorrow tasks** — an end-of-day review feeds tomorrow's plan
- **AI Provider Adapter** — interchangeable `mock` / OpenAI / Anthropic backends
- **localStorage persistence** — everything is saved locally in your browser
- **PWA-ready** — installable on a phone home screen

## Tech stack

- [Next.js](https://nextjs.org) (App Router)
- TypeScript
- Tailwind CSS
- localStorage for persistence
- Next.js API routes (`/api/ai-plan`, `/api/github-radar`)
- OpenAI / Anthropic provider adapter

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) on your computer.

### Test on your phone (same Wi-Fi)

Run the dev server bound to your local network:

```bash
npm run dev:lan
```

Then, on a phone connected to the **same Wi-Fi**, open `http://YOUR_LOCAL_IP:3000`.

To find your local IP on Windows:

1. Open a terminal and run `ipconfig`.
2. Find the **IPv4 Address** under your **Wi-Fi** adapter (e.g. `192.168.1.42`).
3. On your phone, open `http://192.168.1.42:3000`.

If the phone can't connect, allow **Node.js** through the **Windows Firewall** on **Private** networks (Windows Security → Firewall & network protection → Allow an app through firewall).

## Environment variables

Copy the example file and fill in keys locally:

```bash
cp .env.example .env.local
```

| Variable            | Purpose                                            |
| ------------------- | -------------------------------------------------- |
| `AI_PROVIDER`       | `mock`, `openai`, or `anthropic`                   |
| `OPENAI_API_KEY`    | OpenAI key (only when `AI_PROVIDER=openai`)        |
| `OPENAI_MODEL`      | e.g. `gpt-4.1-mini`                                |
| `ANTHROPIC_API_KEY` | Anthropic key (only when `AI_PROVIDER=anthropic`)  |
| `ANTHROPIC_MODEL`   | e.g. `claude-haiku-4-5`                            |

Notes:

- `AI_PROVIDER` can be `mock`, `openai`, or `anthropic`.
- Use `mock` for **free local development** — no key required, and the AI features fall back to it automatically.
- Put **real keys in `.env.local`** locally.
- Put **real keys in Vercel → Project Settings → Environment Variables** in production.
- **Never commit `.env.local`.** It is gitignored. Server keys must **not** be prefixed with `NEXT_PUBLIC_`.

## Public demo vs self-hosting

HamLoop is built so it can be shared publicly **without exposing anyone's AI keys**.

| | Public demo | Self-hosting |
| --- | --- | --- |
| `AI_PROVIDER` | `mock` | `openai` or `anthropic` |
| API key needed | **No** | Yes — your own |
| AI responses | Canned / mock | Real |
| Who pays for AI | No one | You |

- **Public demo** — runs with `AI_PROVIDER=mock`. AI features return canned responses, so the demo is safe to share with anyone and costs nothing. No key is ever loaded.
- **Self-hosting** — to get **real** AI, deploy your own copy and set `AI_PROVIDER=openai` or `anthropic` with your own `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`. Your key stays in your own deployment's environment and is only used server-side.

👉 Full walkthrough: [`docs/self-hosting.md`](docs/self-hosting.md).

## Deployment

HamLoop uses Next.js **API routes**, so it must run on a Node host — deploy it to **Vercel**, *not* GitHub Pages (which is static only).

- **GitHub** is for the source code / portfolio.
- **Vercel** is for the live app.

Steps:

1. Push this repo to GitHub.
2. Import the GitHub repo into [Vercel](https://vercel.com/new).
3. Add environment variables in **Vercel → Project Settings → Environment Variables**.
4. Deploy.
5. Open the Vercel URL on your phone.
6. Use **Add to Home Screen** to install it like an app.

## Current limitation

- This MVP currently uses **localStorage**.
- Data is stored **per browser / per device**.
- Data does **not** sync between your phone and computer yet.
- Cloud sync and auth (Supabase) are planned for a future sprint.

## Roadmap

- PWA polish
- Supabase sync
- Auth
- Better skill extension system
- Research Brief Extension
- Daily analytics / streaks without shame

## Contributing

Contributions are welcome! HamLoop stays mobile-first, ADHD-friendly, and
deliberately simple. Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) before
opening a PR, and run `npx tsc --noEmit` first.

## Security

Never commit `.env.local` and never expose provider keys with `NEXT_PUBLIC_`.
See [`SECURITY.md`](SECURITY.md) for how to report issues privately.

## License

[MIT](LICENSE) © taobuilds

---

See [`docs/launch-checklist.md`](docs/launch-checklist.md) for the step-by-step launch checklist.
