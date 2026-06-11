# HamLoop Launch Checklist

A step-by-step checklist for shipping the HamLoop MVP: local phone test → GitHub → Vercel → home-screen install.

## A. Local phone test tonight

- [ ] Run `npm run dev:lan`
- [ ] Find your local IP (`ipconfig` → IPv4 Address under Wi-Fi)
- [ ] Open `http://YOUR_LOCAL_IP:3000` on the phone (same Wi-Fi)
- [ ] Test the **Today** tab
- [ ] Test the **Build** tab
- [ ] Test the **Skills** tab
- [ ] Test the **Review** tab
- [ ] Generate tomorrow's tasks from the Review tab
- [ ] Confirm there are no console-breaking errors

> If the phone can't connect, allow **Node.js** through the **Windows Firewall** on **Private** networks.

## B. GitHub initial version

- [ ] `git status`
- [ ] Confirm `.env.local` is ignored (`git status` should NOT list it; `git check-ignore .env.local` should print the path)
- [ ] `npm run type-check` (or `npx tsc --noEmit`) — clean
- [ ] `npm run build` — passes
- [ ] `git add .`
- [ ] `git commit -m "launch hamloop mvp"`
- [ ] Create a GitHub repo named `hamloop`
- [ ] Add the remote: `git remote add origin https://github.com/YOUR_USERNAME/hamloop.git`
- [ ] `git push -u origin main`

## C. Vercel deployment

- [ ] Import the GitHub repo into Vercel
- [ ] Add environment variables (`AI_PROVIDER`, and keys if using a real provider)
- [ ] Deploy
- [ ] Test `/api/github-radar` (open the URL, or check the GitHub Skill Radar in-app)
- [ ] Test `/api/ai-plan` by generating tomorrow's tasks through the Review tab
- [ ] Open the live URL on your phone

## D. Add to Home Screen

- [ ] **iPhone (Safari):** Share → Add to Home Screen
- [ ] **Android (Chrome):** menu (⋮) → Add to Home screen / Install app

## E. Known MVP limitations

- No login
- No cloud sync
- localStorage only (data is per browser / per device)
- AI usage depends on the configured provider keys (`mock` works with no key)
- GitHub Radar uses the public GitHub API with mock fallback behavior
