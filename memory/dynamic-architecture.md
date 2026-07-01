---
name: dynamic-architecture
description: How the live/dynamic portfolio pipeline works — data flow from transactions → prices → computed model
metadata:
  type: project
---

The dashboard is now FULLY DYNAMIC (no hardcoded portfolio). Rebuilt 2026-07-01, replacing the old baked `portfolio.ts`/`perf.ts`/`market.ts` (deleted).

**Data flow:** transactions (localStorage, deduped by Nordnet `Id`) → `computePositions` (avg-cost, incl. since-sold) → fetch `/api/prices` by ISIN → `buildPortfolio(txns, prices)` in [src/data/live.ts](../src/data/live.ts) produces EVERY UI shape (kpis, allocMap, tableGroups, holdingsGroups, companyMetrics, getPerformance). Stored as `portfolio` in [useStore.ts](../src/store/useStore.ts); components read `useStore(s => s.portfolio.X)`.

**Backend:** [api/_lib/prices.mjs](../api/_lib/prices.mjs) = generic Yahoo resolver (yahoo-finance2). ISIN→symbol via search (only for real ISINs; `^OMX`/`URTH`/tickers used directly), quote + weekly history, **EUR-normalised** (per-date FX; GBp/minor-units ÷100), returns type/sector/country/assetClass/moneyMarket/divYield. [api/prices.js](../api/prices.js) = Vercel function; [dev-server.mjs](../dev-server.mjs) mirrors it on :5174 for local dev (vite proxies /api→5174).

**Classification (generic, no ISINs):** EQUITY→Stocks; money-market fund (name/assetClass)→Cash equivalent; bond-heavy fund→Fixed income; else Equity fund. **Fallback:** instruments Yahoo can't resolve use last transaction price (held flat). ~9 of the user's 54 traded ISINs are delisted/unindexed → fallback.

**TWR:** `buildTWR` reconstructs weekly holdings over a grid from first txn→now, values at historical prices, computes per-sleeve time-weighted return with external flows (buys/sells/**transfers at market**/deposits) excluded — Nordnet convention. Verified: 1Y ≈ −16.5%, badly underperforming OMXH25 (+30.8%).

**Caching:** prices persisted to localStorage (`pf_prices`, 1h TTL); auto-refetch on load if stale. Re-import merges by `Id` (both refresh & add modes dedupe).

Prices caveat: Node caches imported modules — after editing prices.mjs, RESTART dev-server (kill PID on :5174) or it serves stale resolver code.

See [[build-plan-decisions]], [[dev-environment]].
