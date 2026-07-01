// Shared, incremental price cache backed by Supabase.
//   • instrument_meta : one row per instrument (quote + metadata), refreshed at
//     most every QUOTE_TTL, shared across ALL users.
//   • price_history   : immutable weekly closes (EUR). Each (isin,date) is fetched
//     from Yahoo once, ever — subsequent calls only top up the recent tail.
// If Supabase env vars are absent, transparently falls back to direct Yahoo.
import { createClient } from "@supabase/supabase-js";
import { fetchInstrument, fetchPrices } from "./prices.mjs";

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPA_SECRET = process.env.SUPABASE_SECRET_KEY;
const db = SUPA_URL && SUPA_SECRET ? createClient(SUPA_URL, SUPA_SECRET, { auth: { persistSession: false } }) : null;

export const cacheEnabled = Boolean(db);

const QUOTE_TTL = 15 * 60 * 1000; // refresh a quote at most every 15 minutes

function isoMinusDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function metaToInfo(m, history) {
  if (!m || !m.found) return { isin: m?.isin, found: false };
  return {
    isin: m.isin,
    found: true,
    symbol: m.symbol,
    name: m.name,
    type: m.type,
    currency: "EUR",
    sector: m.sector,
    country: m.country,
    assetClass: m.asset_class,
    moneyMarket: m.money_market,
    divYield: m.div_yield,
    price: m.last_quote,
    prevClose: m.prev_close,
    history: history || [],
  };
}

function infoToMetaRow(r, nowIso) {
  return {
    isin: r.isin,
    symbol: r.symbol ?? null,
    name: r.name ?? null,
    type: r.type ?? null,
    sector: r.sector ?? null,
    country: r.country ?? null,
    asset_class: r.assetClass ?? null,
    money_market: !!r.moneyMarket,
    div_yield: r.divYield ?? 0,
    last_quote: r.price ?? null,
    prev_close: r.prevClose ?? null,
    found: !!r.found,
    quote_updated_at: nowIso,
    meta_updated_at: nowIso,
  };
}

export async function resolvePrices(isins, start = "2021-06-01", force = false) {
  const uniq = [...new Set((isins || []).filter(Boolean))];
  if (!uniq.length) return {};
  if (!db) return fetchPrices(uniq, start); // no cache configured → direct Yahoo

  // 1) batch-read what we already have
  const [{ data: metas }, { data: histRows }] = await Promise.all([
    db.from("instrument_meta").select("*").in("isin", uniq),
    db.from("price_history").select("isin,date,close_eur").in("isin", uniq).order("date", { ascending: true }),
  ]);
  const metaBy = Object.fromEntries((metas || []).map((m) => [m.isin, m]));
  const histBy = {};
  for (const h of histRows || []) (histBy[h.isin] ||= []).push({ date: h.date, close: h.close_eur });

  // 2) decide which instruments are stale (need a Yahoo refresh)
  const now = Date.now();
  const stale = uniq.filter((isin) => {
    const m = metaBy[isin];
    if (force || !m || !m.quote_updated_at) return true;
    return now - new Date(m.quote_updated_at).getTime() >= QUOTE_TTL;
  });

  // 3) refresh stale instruments — fetch only the missing range from Yahoo
  const nowIso = new Date().toISOString();
  const CONC = 4;
  for (let i = 0; i < stale.length; i += CONC) {
    const batch = stale.slice(i, i + CONC);
    await Promise.all(
      batch.map(async (isin) => {
        const existing = histBy[isin] || [];
        const storedMin = existing.length ? existing[0].date : null;
        const storedMax = existing.length ? existing[existing.length - 1].date : null;
        // full/backfill fetch if we have nothing or the request reaches before our
        // earliest stored week; otherwise only re-fetch the recent tail.
        const period1 = !storedMax || (storedMin && start < storedMin) ? start : isoMinusDays(storedMax, 14);
        const r = await fetchInstrument(isin, period1).catch(() => ({ isin, found: false }));

        await db.from("instrument_meta").upsert(infoToMetaRow(r, nowIso), { onConflict: "isin" });
        metaBy[isin] = { ...infoToMetaRow(r, nowIso), quote_updated_at: nowIso };

        if (r.found && r.history?.length) {
          await db
            .from("price_history")
            .upsert(r.history.map((h) => ({ isin, date: h.date, close_eur: h.close })), { onConflict: "isin,date" });
          const merged = new Map(existing.map((h) => [h.date, h.close]));
          for (const h of r.history) merged.set(h.date, h.close);
          histBy[isin] = [...merged.entries()]
            .map(([date, close]) => ({ date, close }))
            .sort((a, b) => (a.date < b.date ? -1 : 1));
        }
      }),
    );
  }

  // 4) assemble the response (only history from `start` onward)
  const out = {};
  for (const isin of uniq) {
    const hist = (histBy[isin] || []).filter((h) => h.date >= start);
    out[isin] = metaToInfo(metaBy[isin] || { isin, found: false }, hist);
  }
  return out;
}
