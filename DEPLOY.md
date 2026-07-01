# Deploy to Vercel

The app is a Vite SPA + serverless functions in `api/`. Vercel auto-detects both.

## 1. Environment variables (Vercel → Project → Settings → Environment Variables)

Set all four for the **Production** (and Preview) environment:

| Name | Value | Used by |
|---|---|---|
| `VITE_SUPABASE_URL` | your Supabase project URL | client (build-time) |
| `VITE_SUPABASE_PUBLIC_KEY` | publishable key (`sb_publishable_…`) | client (build-time) |
| `SUPABASE_URL` | same project URL | serverless functions |
| `SUPABASE_SECRET_KEY` | secret key (`sb_secret_…`) | price cache + keep-alive |

The `VITE_` pair is embedded in the client bundle at build time (safe — RLS-guarded).
The non-prefixed pair is read at runtime by the functions and is never sent to the browser.

## 2. Deploy

From the project directory, with the Vercel CLI:

```bash
npx vercel login      # one-time, interactive (opens browser)
npx vercel            # preview deploy
npx vercel --prod     # production deploy
```

Or connect the folder to Vercel via the dashboard (Add New → Project → import).
Build command `npm run build`, output `dist` (auto-detected).

## 3. After first deploy

- Open the production URL → you should hit the login wall → register/sign in → upload your CSV.
- The daily keep-alive cron (`vercel.json` → `/api/keepalive`) runs automatically on Vercel;
  no setup needed beyond the env vars.
- Supabase password auth works on the Vercel domain out of the box (no redirect config needed,
  since email confirmation is off and we don't use OAuth/magic links yet).

## Notes
- `@supabase/supabase-js` and `yahoo-finance2` are in `dependencies`, so Vercel installs them for the functions.
- If you later enable Google sign-in or email confirmation, add the Vercel URL to
  Supabase → Authentication → URL Configuration (Site URL + redirect allow-list).
