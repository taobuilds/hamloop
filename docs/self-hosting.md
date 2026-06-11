# Self-hosting HamLoop

HamLoop is an open-source, self-hostable AI builder loop app. The public demo
runs in **mock mode** (no real AI). To get real AI, deploy your own copy with
your own provider key. This guide walks through both local development and a
Vercel deployment.

## 1. Clone the repo

```bash
git clone https://github.com/taobuilds/hamloop.git
cd hamloop
```

> Replace the URL with your fork if you forked it.

## 2. Install dependencies

```bash
npm install
```

## 3. Create your local env file

Copy the key-less example and edit it:

```bash
cp .env.example .env.local
```

`.env.local` is gitignored — your keys never get committed.

## 4. Choose your AI provider

Edit `.env.local` and set `AI_PROVIDER` to one of:

### `mock` — free, no key required

```env
AI_PROVIDER=mock
```

Best for trying the app and for local development. All AI features return
canned responses. Nothing leaves your machine.

### `openai`

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...your-key...
OPENAI_MODEL=gpt-4.1-mini
```

### `anthropic`

```env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...your-key...
ANTHROPIC_MODEL=claude-haiku-4-5
```

> Provider keys are **server-only**. Never prefix them with `NEXT_PUBLIC_`.
> See [`SECURITY.md`](../SECURITY.md).

## 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To test on your phone over the same Wi-Fi:

```bash
npm run dev:lan
```

Then open `http://YOUR_LOCAL_IP:3000` on your phone. (See the
[README](../README.md#test-on-your-phone-same-wi-fi) for finding your IP.)

## 6. Deploy to Vercel

HamLoop uses Next.js API routes, so it needs a Node host. Vercel is the easiest
path (GitHub Pages won't work — it's static only).

1. Push your repo to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new).
3. In **Project Settings → Environment Variables**, add:
   - `AI_PROVIDER` — `mock` for a safe public demo, or `openai` / `anthropic`
     for your own private deployment.
   - If using a real provider, add the matching `*_API_KEY` and `*_MODEL`.
4. Deploy.
5. Open the Vercel URL on your phone and use **Add to Home Screen** to install
   it like an app.

### Keeping your public demo safe

If you publish a demo for others, set `AI_PROVIDER=mock`. That way no real key
is ever loaded, and no one can spend your AI credits. Keep real keys only on a
private deployment that you control.
