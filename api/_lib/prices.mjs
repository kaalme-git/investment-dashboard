// Generic price resolver — Yahoo Finance (yahoo-finance2), by ISIN, for ANY
// instrument. Resolves ISIN→symbol via search, quotes + weekly history, and
// normalizes every value to EUR (per-date FX). No hardcoded instruments.
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

const fxMemo = new Map();
// factor to convert `cur` → EUR, current + per-date (nearest ≤ date)
async function fxConverter(cur, period1) {
  if (!cur || cur === "EUR") return { current: 1, at: () => 1 };
  const key = cur + "|" + period1;
  if (fxMemo.has(key)) return fxMemo.get(key);
  const sym = `EUR${cur}=X`; // units of `cur` per 1 EUR
  const [q, c] = await Promise.all([
    yf.quote(sym).catch(() => null),
    yf.chart(sym, { period1, interval: "1wk" }).catch(() => null),
  ]);
  const nowRate = q?.regularMarketPrice || null;
  const pts = (c?.quotes || []).filter((r) => r.close != null).map((r) => ({ d: +r.date, v: r.close }));
  const conv = {
    current: nowRate ? 1 / nowRate : 1,
    at: (date) => {
      const t = +date;
      let v = null;
      for (const p of pts) { if (p.d <= t) v = p.v; else break; }
      return v ? 1 / v : nowRate ? 1 / nowRate : 1;
    },
  };
  fxMemo.set(key, conv);
  return conv;
}

// ISINs (2 letters + 9 alnum + check digit) get resolved to a symbol via search;
// anything else (^OMX, ^GSPC, URTH, XMEM.L, EURUSD=X) is treated as a direct
// Yahoo symbol so index/ticker lookups aren't hijacked by fuzzy ISIN search.
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

// Yahoo topHoldings.sectorWeightings keys → display labels (aligned with the
// stock sector labels produced by normSector in live.ts) for equity-fund look-through.
const FUND_SECTOR = {
  technology: "Technology",
  financial_services: "Financials",
  consumer_cyclical: "Consumer disc.",
  consumer_defensive: "Consumer staples",
  basic_materials: "Materials",
  communication_services: "Communications",
  healthcare: "Healthcare",
  industrials: "Industrials",
  energy: "Energy",
  utilities: "Utilities",
  realestate: "Real Estate",
};
// Yahoo symbol exchange-suffix → country, for inferring a fund's dominant region
// from its top holdings (fallback only — most funds resolve by mandate name in live.ts).
const SUFFIX_COUNTRY = {
  HE: "Finland", ST: "Sweden", OL: "Norway", CO: "Denmark", IC: "Iceland",
  L: "United Kingdom", DE: "Germany", F: "Germany", PA: "France", AS: "Netherlands",
  BR: "Belgium", MC: "Spain", MI: "Italy", SW: "Switzerland", VI: "Austria", LS: "Portugal", IR: "Ireland",
  TW: "Taiwan", KS: "South Korea", KQ: "South Korea", T: "Japan", HK: "Hong Kong",
  SS: "China", SZ: "China", SI: "Singapore", AX: "Australia", NZ: "New Zealand", BO: "India", NS: "India",
};

export async function fetchInstrument(isin, period1) {
  let sym = isin, type = null, sname = isin;
  if (ISIN_RE.test(isin)) {
    try {
      const s = await yf.search(isin, { quotesCount: 6, newsCount: 0 });
      const hit = (s?.quotes || []).find((q) => q.symbol);
      if (hit) { sym = hit.symbol; type = hit.quoteType; sname = hit.shortname || hit.longname || isin; }
    } catch { /* fall through to raw isin */ }
  }

  let q = null;
  try { q = await yf.quote(sym); } catch { /* ignore */ }
  if (!q?.regularMarketPrice) return { isin, found: false };

  // Minor-unit currencies (GBp pence, ZAc cents, ILA agorot): price is in 1/100
  // of the major unit. Normalise to the major currency and divide by 100.
  let cur = q.currency || "EUR";
  let minorDiv = 1;
  if (cur.length === 3 && /[a-z]/.test(cur[2])) { minorDiv = 100; cur = cur.toUpperCase(); }
  const fx = await fxConverter(cur, period1);
  const conv = (v) => (v / minorDiv) * fx.current;

  // Weekly history. Yahoo's chart endpoint rate-limits under batch load and then
  // throws (or returns nothing) — retry a few times with backoff so a transient
  // limit doesn't leave the instrument permanently history-less in the cache.
  let history = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const c = await yf.chart(sym, { period1, interval: "1wk" });
      history = (c?.quotes || [])
        .filter((r) => r.close != null)
        .map((r) => ({ date: r.date.toISOString().slice(0, 10), close: +((r.close / minorDiv) * fx.at(r.date)).toFixed(4) }));
      if (history.length) break;
    } catch { /* rate-limited or transient — retry */ }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }

  const t = type || q.quoteType || "EQUITY";
  const name = q.longName || q.shortName || sname;
  const divYield = q.trailingAnnualDividendYield != null
    ? +(q.trailingAnnualDividendYield * 100).toFixed(2)
    : q.dividendYield != null ? +(+q.dividendYield).toFixed(2) : 0;

  let sector = null, country = null, assetClass = null;
  let sectorWeights = null, regionHint = null;
  const MM_RE = /liquidity|money.?market|rahamarkkina|likvid|kassa|ultra.?short|overnight|euro short|short.?term (bond|fixed|money)|t-?bill|treasury bill/i;
  const moneyMarket = MM_RE.test(name);

  if (t === "EQUITY") {
    try {
      const p = await yf.quoteSummary(sym, { modules: ["assetProfile"] });
      sector = p?.assetProfile?.sector || null;
      country = p?.assetProfile?.country || null;
    } catch { /* optional */ }
  } else if (t === "ETF" || t === "MUTUALFUND") {
    // asset class from holdings: bond-heavy → Fixed income, stock-heavy → Equity.
    // Also capture sector weightings (for equity-fund look-through) and a region
    // hint (dominant country of the top holdings, by listing exchange).
    try {
      const p = await yf.quoteSummary(sym, { modules: ["topHoldings"] });
      const th = p?.topHoldings;
      const bond = th?.bondPosition ?? 0;
      const stock = th?.stockPosition ?? 0;
      if (moneyMarket) assetClass = "Money Market";
      else if (bond > stock && bond > 0.5) assetClass = "Fixed Income";
      else if (stock > 0) assetClass = "Equity";

      if (th?.sectorWeightings?.length) {
        const sw = {};
        for (const row of th.sectorWeightings) {
          const key = Object.keys(row)[0];
          const label = FUND_SECTOR[key];
          const w = +row[key];
          if (label && w > 0) sw[label] = (sw[label] || 0) + w;
        }
        if (Object.keys(sw).length) sectorWeights = sw;
      }
      if (th?.holdings?.length) {
        const tally = {};
        for (const h of th.holdings) {
          const parts = (h.symbol || "").split(".");
          const suf = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "US";
          const c = SUFFIX_COUNTRY[suf] || (suf === "US" ? "USA" : null);
          if (c) tally[c] = (tally[c] || 0) + (h.holdingPercent || 0.01);
        }
        regionHint = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0] || null;
      }
    } catch { /* optional */ }
    if (!assetClass) {
      if (moneyMarket) assetClass = "Money Market";
      else if (/bond|fixed income|korko|oblig|treasury|govt|government|aggregate/i.test(name)) assetClass = "Fixed Income";
      else assetClass = "Equity";
    }
  }

  return {
    isin,
    found: true,
    symbol: sym,
    name,
    type: t, // EQUITY | ETF | MUTUALFUND | INDEX | ...
    currency: "EUR",
    srcCurrency: cur,
    price: +conv(q.regularMarketPrice).toFixed(4),
    prevClose: +conv(q.regularMarketPreviousClose ?? q.regularMarketPrice).toFixed(4),
    sector,
    country,
    assetClass, // Equity | Fixed Income | Money Market (funds only)
    sectorWeights, // { displaySector: weight 0..1 } for equity-fund sector look-through
    regionHint, // dominant country of top holdings (fund region fallback)
    moneyMarket,
    divYield,
    history,
  };
}

// Resolve many ISINs with limited concurrency.
export async function fetchPrices(isins, period1 = "2021-06-01") {
  const uniq = [...new Set((isins || []).filter(Boolean))];
  const out = {};
  const CONC = 4;
  for (let i = 0; i < uniq.length; i += CONC) {
    const batch = uniq.slice(i, i + CONC);
    const res = await Promise.all(batch.map((x) => fetchInstrument(x, period1).catch(() => ({ isin: x, found: false }))));
    res.forEach((r) => (out[r.isin] = r));
  }
  return out;
}
