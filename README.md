# Inderes Portfolio Dashboard

A live, multi-user investment dashboard: upload your Nordnet transaction export
and it reconstructs your portfolio, prices it, and computes time-weighted returns
against a benchmark — all from your real data.

**Live:** https://investment-dashboard-six-liard.vercel.app

Stack: **Vite + React 18 + TypeScript + React Router + Zustand**, **Supabase**
(auth + Postgres), and **Vercel** serverless functions. Charts are hand-rolled SVG
(no charting dependency). Styling uses the real Inderes design tokens and fonts.

## How it works

- **Transactions → positions → prices → model.** Uploaded transactions (deduped by
  Nordnet `Id`) drive `buildPortfolio()` in [src/data/live.ts](src/data/live.ts),
  which reconstructs holdings, classifies them generically (stock / equity fund /
  fixed-income fund / cash-equivalent), and computes a Nordnet-style TWR including
  since-sold instruments. Nothing is hardcoded to one portfolio.
- **Accounts.** Supabase email/password auth; each account's transactions and
  settings are private via row-level security.
- **Shared incremental price cache.** [api/_lib/cache.mjs](api/_lib/cache.mjs)
  resolves any ISIN via Yahoo (EUR-normalized), stores immutable weekly history in
  Postgres, and only fetches missing data — warm reads are ~0.1s and shared across
  all users. A daily cron keeps the DB awake.

## Run it locally

Node is a portable install at `%LOCALAPPDATA%\nodejs-portable`.

```bash
npm install                    # first time only
node dev-server.mjs            # price API on :5174 (reads .env.local)
npm run dev                    # app on http://localhost:5173 (proxies /api → :5174)
```

Create a `.env.local` (git-ignored) with your Supabase keys — see
[SUPABASE_SETUP.md](SUPABASE_SETUP.md) for the variable names. Without them the app
runs in single-user local mode (localStorage, no login). Optional: `GROQ_API_KEY`
(free, console.groq.com) enables the "Ask about my portfolio" assistant.

```bash
npm run build                  # type-check + production build into dist/
```

## Deploy

Push-to-deploy via Vercel's GitHub integration: every push to `main` deploys to
production, other branches get preview URLs. Manual deploy: `npx vercel --prod`.
Env vars and full steps in [DEPLOY.md](DEPLOY.md).

## Project layout

```
api/            Vercel serverless functions (price cache, keep-alive) + _lib
src/
  charts/       SVG chart components (Donut, LineChart, Sparkline, …)
  data/         live.ts (portfolio engine), transactions parser, DB repos
  lib/          Supabase client + RNG helpers
  screens/      One folder per screen (dashboard/, AuthScreen, …)
  store/        Zustand state (auth, transactions, prices, settings)
  styles/       Inderes design tokens + component CSS
supabase/       schema.sql (tables + row-level security)
```
