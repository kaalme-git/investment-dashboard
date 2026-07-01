---
name: accounts-and-cache
description: Supabase accounts (auth + per-user transactions) and the shared incremental price cache
metadata:
  type: project
---

The dashboard is a MULTI-USER app on Supabase (chosen over Firebase/Vercel-native/Clerk on 2026-07-01). Free tier + a daily keep-alive cron so it never pauses.

**Project:** hkhmdfrkzisvitetnjai.supabase.co. Keys in `.env.local` (git-ignored): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLIC_KEY` (publishable), `SUPABASE_SECRET_KEY` (service, server-only). Email confirmation is OFF (instant login). Schema in [supabase/schema.sql](../supabase/schema.sql). Setup steps in [SUPABASE_SETUP.md](../SUPABASE_SETUP.md).

**Tables (RLS):** `transactions` per-user PK (user_id, txn_id); `instrument_meta` + `price_history` SHARED, readable by all, written only by the service key; `user_settings` per-user (Phase 3, not wired yet).

**Auth (Phase 1, done):** [src/lib/supabase.ts](../src/lib/supabase.ts) client; store ([useStore.ts](../src/store/useStore.ts)) holds user/authReady/authBusy + initAuth/signIn/signUp/signOut/loadUserData. [src/Root.tsx](../src/Root.tsx) gates: loader → [AuthScreen](../src/screens/AuthScreen.tsx) → app. [txnsRepo.ts](../src/data/txnsRepo.ts) maps Txn↔DB and upserts (dedupe by txn_id; refresh mode deletes-then-inserts). If Supabase env absent → LOCAL_MODE (localStorage, no login).

**Shared price cache (Phase 2, done):** [api/_lib/cache.mjs](../api/_lib/cache.mjs) `resolvePrices(isins,start,force)` — batch-reads instrument_meta+price_history, refreshes only STALE instruments (quote older than 15min QUOTE_TTL, or force), fetches from Yahoo only the missing range (full/backfill if start<storedMin, else tail = storedMax−14d), upserts. Historical weeks fetched once ever, shared. Verified: warm read 0.11s vs cold 4.6s. Both [api/prices.js](../api/prices.js) (Vercel) and [dev-server.mjs](../dev-server.mjs) (local, loads .env.local) call it; falls back to direct Yahoo if no Supabase env. Client passes `force` on upload/explicit refresh; client localStorage cache kept as offline fallback (5min dedupe window).

**Keep-alive:** [api/keepalive.js](../api/keepalive.js) + vercel.json crons `0 6 * * *` pings the DB daily.

**Settings (Phase 3, done):** [src/data/settingsRepo.ts](../src/data/settingsRepo.ts) load/save user_settings; store loads them in loadUserData and debounce-saves (scheduleSettingsSave, 700ms) on setStrategyText/setTarget/addWatch/removeWatch/setNote. jsonb reorders object keys but preserves values (app reads by key). Verified round-trip + RLS.

**Remaining:** deploy to Vercel — see [DEPLOY.md](../DEPLOY.md). Needs env vars VITE_SUPABASE_URL, VITE_SUPABASE_PUBLIC_KEY (client build) + SUPABASE_URL, SUPABASE_SECRET_KEY (functions). See [[dynamic-architecture]].
