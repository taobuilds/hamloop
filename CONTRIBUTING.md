# Contributing to HamLoop

Thanks for your interest in improving HamLoop! It's a small, focused app, and
contributions are welcome. Please keep changes aligned with the project's
spirit before opening a PR.

## Project principles

These are the things that make HamLoop what it is. Please respect them:

- **Keep the UI mobile-first.** HamLoop is built to be used on a phone. Design
  and test for small screens first, then scale up.
- **Keep the UX ADHD-friendly.** One small loop a day. Favor calm, low-friction,
  single-focus flows over screens packed with options and decisions.
- **Do not add heavy dashboard complexity.** No sprawling settings panels,
  multi-pane dashboards, or feature creep. Simplicity is a feature.
- **No databases, auth, or accounts in core.** Persistence stays in
  `localStorage` for now. Cloud sync is a future, opt-in concern.

## Before you open a PR

1. Make your change on a branch.
2. Run the type checker — it must pass with no errors:
   ```bash
   npx tsc --noEmit
   ```
3. (Recommended) Run a production build to catch issues early:
   ```bash
   npm run build
   ```
4. Never commit secrets. `.env.local` is gitignored — keep it that way. See
   [`SECURITY.md`](SECURITY.md).

## Pull requests

- Keep PRs small and focused on one thing.
- Describe **what** changed and **why** in the PR description.
- Include a screenshot or short clip for any UI change (mobile viewport).

## Getting set up

See [`docs/self-hosting.md`](docs/self-hosting.md) for local setup. The short
version:

```bash
npm install
cp .env.example .env.local   # AI_PROVIDER=mock works with no key
npm run dev
```

Thanks for keeping the loop small. 🟢
