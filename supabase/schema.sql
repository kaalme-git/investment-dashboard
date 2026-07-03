-- ============================================================================
-- Investment Dashboard — Supabase schema
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query → Run).
-- Design:
--   • transactions      → PER-USER, immutable ledger, deduped by (user_id, txn_id)
--   • instrument_meta   → SHARED across all users (no PII), written only by the
--                         price serverless function (service role)
--   • price_history     → SHARED immutable weekly closes; each (isin,date) fetched once
--   • user_settings     → PER-USER strategy / targets / watchlist / notes
-- Row-level security ensures each user can only read/write their own rows.
-- ============================================================================

-- 1) Per-user transactions -----------------------------------------------------
create table if not exists public.transactions (
  user_id    uuid not null references auth.users (id) on delete cascade,
  txn_id     text not null,               -- Nordnet "Id" (or composite fallback)
  date       date,
  raw_type   text,
  category   text,                        -- buy|sell|dividend|deposit|... (our TxCategory)
  name       text,
  ticker     text,
  isin       text,
  qty        double precision default 0,
  price      double precision default 0,
  fee        double precision default 0,
  amount     double precision default 0,  -- signed cash effect (Nordnet "Summa")
  acq_value  double precision default 0,
  ccy        text default 'EUR',
  created_at timestamptz default now(),
  primary key (user_id, txn_id)
);
create index if not exists transactions_user_isin_idx on public.transactions (user_id, isin);

alter table public.transactions enable row level security;
drop policy if exists "own transactions" on public.transactions;
create policy "own transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2) Shared instrument metadata (readable by all, written by service role) -----
create table if not exists public.instrument_meta (
  isin             text primary key,
  symbol           text,
  name             text,
  type             text,                  -- EQUITY | ETF | MUTUALFUND | INDEX
  sector           text,
  country          text,
  asset_class      text,                  -- Equity | Fixed Income | Money Market
  money_market     boolean default false,
  div_yield        double precision default 0,
  last_quote       double precision,      -- current price, EUR
  prev_close       double precision,      -- previous close, EUR
  found            boolean default true,
  quote_updated_at timestamptz,
  meta_updated_at  timestamptz default now(),
  -- Inderes analyst data (recommendation + target price are public on inderes.fi)
  rec              text,                  -- BUY | INCREASE | HOLD | REDUCE | SELL
  target_price     double precision,
  rec_date         date,                  -- date of the analyst recommendation
  rec_updated_at   timestamptz,           -- when we last refreshed rec from Inderes (daily TTL)
  div_estimates    jsonb,                 -- analyst dividend/share estimates { year: dps } for T, T+1, T+2 (EUR)
  eps_estimates    jsonb,                 -- analyst EPS estimates { year: eps } for T, T+1, T+2 (EUR) → P/E
  pe_trailing      double precision,      -- Yahoo trailing P/E (stocks; fallback P/E source)
  sector_weights   jsonb,                 -- equity-fund sector look-through { displaySector: weight 0..1 }
  region_hint      text                   -- dominant country of a fund's top holdings (region fallback)
);
-- If the table already exists from an earlier run, add the Inderes columns:
alter table public.instrument_meta add column if not exists rec text;
alter table public.instrument_meta add column if not exists target_price double precision;
alter table public.instrument_meta add column if not exists rec_date date;
alter table public.instrument_meta add column if not exists rec_updated_at timestamptz;
alter table public.instrument_meta add column if not exists div_estimates jsonb;
alter table public.instrument_meta add column if not exists eps_estimates jsonb;
alter table public.instrument_meta add column if not exists pe_trailing double precision;
alter table public.instrument_meta add column if not exists sector_weights jsonb;
alter table public.instrument_meta add column if not exists region_hint text;
alter table public.instrument_meta enable row level security;
drop policy if exists "meta readable" on public.instrument_meta;
create policy "meta readable" on public.instrument_meta for select using (true);
-- (no INSERT/UPDATE policy → only the service-role key can write)

-- 3) Shared immutable weekly price history -------------------------------------
create table if not exists public.price_history (
  isin      text not null,
  date      date not null,
  close_eur double precision not null,
  primary key (isin, date)
);
create index if not exists price_history_isin_date_idx on public.price_history (isin, date);
alter table public.price_history enable row level security;
drop policy if exists "history readable" on public.price_history;
create policy "history readable" on public.price_history for select using (true);
-- (no write policy → service-role only)

-- 4) Per-user settings (Phase 3) ----------------------------------------------
create table if not exists public.user_settings (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  strategy   text,
  targets    jsonb,
  watchlist  jsonb,
  notes      jsonb,
  bench      text,   -- Overview benchmark selection
  calc       jsonb,  -- Calculations inputs (returns, monthly, years, target, allocMode)
  style_overrides jsonb, -- per-instrument active/passive overrides { isin: 'active'|'passive' }
  stock_styles jsonb, -- per-stock company type { isin: 'growth'|'cyclical'|'defensive'|'neutral' }
  deposit_exclusions jsonb, -- txn ids excluded from net-deposit figures { txnId: true }
  updated_at timestamptz default now()
);
-- If the table already exists from an earlier run:
alter table public.user_settings add column if not exists bench text;
alter table public.user_settings add column if not exists calc jsonb;
alter table public.user_settings add column if not exists style_overrides jsonb;
alter table public.user_settings add column if not exists stock_styles jsonb;
alter table public.user_settings add column if not exists deposit_exclusions jsonb;
alter table public.user_settings enable row level security;
drop policy if exists "own settings" on public.user_settings;
create policy "own settings" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Company attachments (Supabase STORAGE, bucket "company-files", private).
-- Objects live under {userId}/{ticker}/{scope}/{file}; each user may only
-- touch their own {userId}/ folder. The bucket itself is created via the API
-- (or Dashboard → Storage); these policies must be run in the SQL editor.
-- ---------------------------------------------------------------------------
drop policy if exists "own company files select" on storage.objects;
create policy "own company files select" on storage.objects for select
  using (bucket_id = 'company-files' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own company files insert" on storage.objects;
create policy "own company files insert" on storage.objects for insert
  with check (bucket_id = 'company-files' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own company files delete" on storage.objects;
create policy "own company files delete" on storage.objects for delete
  using (bucket_id = 'company-files' and (storage.foldername(name))[1] = auth.uid()::text);
