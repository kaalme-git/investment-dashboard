# Supabase setup — one-time (you do this; then I wire the code)

This is the only part that needs your interactive login. ~10 minutes.

## 1. Create the project
1. Go to https://supabase.com → sign in (GitHub login is easiest).
2. **New project** → name it (e.g. `investment-dashboard`), choose the EU (Frankfurt) region, set a database password (save it), Free plan.
3. Wait ~2 min for it to provision.

## 2. Create the tables
1. Left sidebar → **SQL Editor** → **New query**.
2. Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
3. You should see the 4 tables under **Table Editor**: `transactions`, `instrument_meta`, `price_history`, `user_settings`.

## 3. Turn on email/password auth
1. Left sidebar → **Authentication** → **Providers** → ensure **Email** is enabled.
2. (Optional) enable **Google** for one-click sign-in later.
3. Under **Authentication → Sign In / Providers**, for easy testing you can turn *off*
   "Confirm email" so accounts work instantly; turn it back on before sharing widely.

## 4. Give me the keys
From **Project Settings → API**, copy these into a new file `.env.local` (see `.env.example`):

- **Project URL** → `VITE_SUPABASE_URL`
- **anon / public** key → `VITE_SUPABASE_ANON_KEY`
- **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`  ← secret, server-only

> Paste them into `.env.local` yourself (it's git-ignored) — you don't need to send the
> secret key to me in chat; just tell me once they're in place and I'll wire the code.

## 5. Keep-alive (prevents the 7-day free-tier pause)
Once deployed to Vercel, a daily cron pings the DB so the project never pauses. I'll
add the `api/keepalive.js` function + the `crons` entry in `vercel.json` during the build —
nothing for you to do here beyond setting the same env vars in Vercel later.

---

When steps 1–4 are done, tell me and I'll build Phase 1: login wall, per-user
transaction storage (server-side dedupe by Nordnet Id), and migrate the app off
localStorage onto your account.
