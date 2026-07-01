# Inderes Portfolio Dashboard

A web-based investment dashboard built on the Inderes Design System, implemented
from the handoff in `design_handoff_portfolio_dashboard/`.

Stack: **Vite + React 18 + TypeScript + React Router + Zustand**. Charts are
hand-rolled SVG (ported from the prototype) — no charting dependency. Styling
uses the real Inderes design tokens (`src/styles/tokens.css`) and fonts.

## Run it locally

Node is installed at `%LOCALAPPDATA%\nodejs-portable` and on your PATH.

```bash
npm install        # first time only
npm run dev         # dev server with hot reload → http://localhost:5173
```

Other scripts:

```bash
npm run build       # type-check + production build into dist/
npm run preview     # serve the production build → http://localhost:4173
```

## Deploy to the cloud (Vercel)

One-time setup, run from this folder:

```bash
npx vercel          # first run: log in (opens a browser), then accept the defaults
npx vercel --prod   # publish a production URL you can share / revisit
```

Vercel auto-detects Vite (build `npm run build`, output `dist`). `vercel.json`
already routes client-side paths to `index.html`. Every push/redeploy gives a
fresh URL.

## Project layout

```
src/
  charts/        SVG chart components (Donut, LineChart, Sparkline, …)
  components/    App shell, top nav, shared bits
  data/          Mock data + pure compute fns — the "data contract" (types.ts)
  lib/           Deterministic RNG helpers for series/sparklines
  screens/       One folder per screen (dashboard/, …)
  store/         Zustand UI state
  styles/        tokens.css (Inderes tokens) + dashboard.css (ported component CSS)
  icons/         Inderes in-house SVG icon set (React components)
public/fonts/    GT America + Inderes Mono webfonts
```

## Status

- [x] Phase 0 — scaffold, tokens/fonts, app shell, data layer, chart primitives
- [x] Phase 1 — Dashboard → Overview
- [ ] Allocation · Holdings · Transactions · Watchlist · Company · Research · Report · Strategy · Calculations
- [ ] Wire the "Ask about my portfolio" box to a Claude serverless proxy (`/api/ask`)
