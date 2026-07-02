// Shared, incremental price cache backed by Supabase.
//   • instrument_meta : one row per instrument (quote + metadata), refreshed at
//     most every QUOTE_TTL, shared across ALL users.
//   • price_history   : immutable weekly closes (EUR). Each (isin,date) is fetched
//     from Yahoo once, ever — subsequent calls only top up the recent tail.
// If Supabase env vars are absent, transparently falls back to direct Yahoo.
import { createClient } from "@supabase/supabase-js";
import { fetchInstrument, fetchPrices } from "./prices.mjs";
import { fetchRecs } from "./inderes.mjs";

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
    sectorWeights: m.sector_weights ?? null,
    regionHint: m.region_hint ?? null,
    moneyMarket: m.money_market,
    divYield: m.div_yield,
    price: m.last_quote,
    prevClose: m.prev_close,
    rec: m.rec ?? null,
    targetPrice: m.target_price ?? null,
    recDate: m.rec_date ?? null,
    divEstimates: m.div_estimates ?? null,
    epsEstimates: m.eps_estimates ?? null,
    peTrailing: m.pe_trailing ?? null,
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
    sector_weights: r.sectorWeights ?? null,
    region_hint: r.regionHint ?? null,
    money_market: !!r.moneyMarket,
    div_yield: r.divYield ?? 0,
    pe_trailing: r.peTrailing ?? null,
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
    // A found instrument with zero stored history is incomplete (Yahoo's chart
    // endpoint likely got rate-limited on an earlier batch fetch). Keep retrying
    // it — decoupled from the quote TTL — until history backfills. Once stored,
    // this stops firing. Without this, such instruments stay frozen at a flat
    // fallback price, distorting returns and hiding the 3-month sparkline.
    if (m.found && !(histBy[isin] && histBy[isin].length)) return true;
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
        // keep Inderes fields (rec/target/rec_date) that the Yahoo refresh doesn't touch
        metaBy[isin] = { ...(metaBy[isin] || {}), ...infoToMetaRow(r, nowIso), quote_updated_at: nowIso };

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

  // 3a) INITIAL population of recommendations for newly-held equities only
  // (rec_updated_at is null). Scheduled refreshes happen via the 10:00-weekday
  // cron (api/refresh-recs) — not on every dashboard open. Covers renamed ISINs
  // too by including any rec row that shares a Yahoo symbol with a held equity.
  try {
    const heldEqSyms = [...new Set(uniq.map((i) => metaBy[i]).filter((m) => m && m.type === "EQUITY" && m.symbol).map((m) => m.symbol))];
    if (heldEqSyms.length) {
      const { data: cand } = await db.from("instrument_meta").select("isin,symbol,rec_updated_at").in("symbol", heldEqSyms);
      const toRefresh = (cand || []).filter((r) => !r.rec_updated_at).map((r) => r.isin);
      if (toRefresh.length) {
        const recs = await fetchRecs(toRefresh);
        const stamp = new Date().toISOString();
        // stamp every checked ISIN (so not-found renamed ISINs aren't retried for a day);
        // set rec fields only when Inderes returned one; div_estimates = DPS estimates T/T+1/T+2.
        const rows = toRefresh.map((isin) => {
          const r = recs[isin];
          const base = r?.rec
            ? { isin, rec: r.rec, target_price: r.targetPrice, rec_date: r.recDate }
            : { isin };
          return { ...base, div_estimates: r?.divEstimates ?? null, eps_estimates: r?.epsEstimates ?? null, rec_updated_at: stamp };
        });
        await db.from("instrument_meta").upsert(rows, { onConflict: "isin" });
        for (const isin of uniq) {
          const r = recs[isin];
          if (r?.rec && metaBy[isin]) { metaBy[isin].rec = r.rec; metaBy[isin].target_price = r.targetPrice; metaBy[isin].rec_date = r.recDate; }
        }
      }
    }
  } catch { /* recommendations are best-effort */ }

  // 3b) Inderes-data fallback by Yahoo symbol — handles instruments whose ISIN
  // changed via a corporate action (old & new ISIN share the same symbol, e.g.
  // Talenom). If a requested instrument is missing rec or dividend estimates,
  // borrow them from any instrument_meta row with the same symbol.
  const needFb = uniq.filter((i) => metaBy[i] && metaBy[i].symbol && (!metaBy[i].rec || !metaBy[i].div_estimates || !metaBy[i].eps_estimates));
  const wantSyms = [...new Set(needFb.map((i) => metaBy[i].symbol))];
  if (wantSyms.length) {
    const { data: recRows } = await db
      .from("instrument_meta")
      .select("symbol,rec,target_price,rec_date,div_estimates,eps_estimates")
      .in("symbol", wantSyms);
    const bySymRec = {};
    const bySymDiv = {};
    const bySymEps = {};
    for (const r of recRows || []) {
      if (r.rec && !bySymRec[r.symbol]) bySymRec[r.symbol] = r;
      if (r.div_estimates && !bySymDiv[r.symbol]) bySymDiv[r.symbol] = r;
      if (r.eps_estimates && !bySymEps[r.symbol]) bySymEps[r.symbol] = r;
    }
    for (const i of needFb) {
      const m = metaBy[i];
      if (!m.rec && bySymRec[m.symbol]) { const r = bySymRec[m.symbol]; m.rec = r.rec; m.target_price = r.target_price; m.rec_date = r.rec_date; }
      if (!m.div_estimates && bySymDiv[m.symbol]) m.div_estimates = bySymDiv[m.symbol].div_estimates;
      if (!m.eps_estimates && bySymEps[m.symbol]) m.eps_estimates = bySymEps[m.symbol].eps_estimates;
    }
  }

  // 4) assemble the response (only history from `start` onward)
  const out = {};
  for (const isin of uniq) {
    const hist = (histBy[isin] || []).filter((h) => h.date >= start);
    out[isin] = metaToInfo(metaBy[isin] || { isin, found: false }, hist);
  }
  return out;
}
