---
name: dev-environment
description: How to run/build/screenshot the Investment Dashboard app on this machine
metadata:
  type: project
---

Building a React/TS investment dashboard from `design_handoff_portfolio_dashboard/` (Inderes Design System). Stack: Vite + React 18 + TS + React Router + Zustand; charts are hand-ported SVG (no charting lib).

Non-obvious environment facts:
- **Node was NOT installed system-wide.** Installed portable Node v24.18.0 at `%LOCALAPPDATA%\nodejs-portable\node-v24.18.0-win-x64` and added it to the **user PATH**. New shells spawned by tools may not inherit it — prepend `$env:Path = "$env:LOCALAPPDATA\nodejs-portable\node-v24.18.0-win-x64;$env:Path"` in PowerShell before npm.
- **Preview/screenshot workflow** (no browser-automation tool): `npm run build` → `npm run preview -- --port 4173 --host`, then Chrome headless screenshot: `& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$env:TEMP\chrome-shot-profile" --window-size=1340,2400 --virtual-time-budget=4000 --screenshot="out.png" "http://localhost:4173/dashboard/overview"`. Read the PNG to compare against `design_handoff_portfolio_dashboard/screenshots/`.
- Project lives in a OneDrive-synced path (spaces in path); `node_modules`/`dist` are gitignored.
- Deployment target: **Vercel** (decided with user). AI "Ask about my portfolio" box is **stubbed** (to be wired to a `/api/ask` Claude proxy later). See [[build-plan-decisions]].
