// Live Inderes data via the public Inderes GraphQL API (no auth).
// fetchRecs returns, per ISIN: recommendation (Int 1-5 → enum), target price
// (EUR), and dividend-per-share + EPS estimates for the current year and the
// next two (T, T+1, T+2), EUR only. Batched via aliased queries.
const ENDPOINT = "https://www.inderes.fi/api/graphql";
const REC_ENUM = { 1: "SELL", 2: "REDUCE", 3: "HOLD", 4: "INCREASE", 5: "BUY" };
const HEADERS = { "Content-Type": "application/json", "User-Agent": "Inderes AI Labs", "Accept-Languages": "en,fi,sv,da" };
const Y0 = new Date().getFullYear();
const DIV_YEARS = [Y0, Y0 + 1, Y0 + 2];

const F =
  "isin symbol researchCurrency reportingCurrency estimateData { estimates { recommendation targetPrice date } } " +
  "estimateTransactions(first:1){ estimates { year quarter dividend epsReported } }";

async function fetchChunk(chunk, out) {
  const q = "query {" + chunk.map((isin, i) => `i${i}: instrument(isin:${JSON.stringify(isin)}){ ${F} }`).join(" ") + "}";
  let json;
  try {
    const res = await fetch(ENDPOINT, { method: "POST", headers: HEADERS, body: JSON.stringify({ query: q }) });
    json = await res.json();
  } catch {
    return; // network/best-effort
  }
  const data = json?.data || {};
  chunk.forEach((isin, i) => {
    const inst = data["i" + i];
    if (!inst) return;
    const est = inst.estimateData?.estimates;
    const eur = (inst.researchCurrency || "EUR") === "EUR";
    const rec = est?.recommendation ? REC_ENUM[est.recommendation] || null : null;

    // dividend-per-share + EPS estimates for T, T+1, T+2 (full-year rows), EUR only
    let divEstimates = null;
    let epsEstimates = null;
    if ((inst.reportingCurrency || "EUR") === "EUR") {
      const rows = inst.estimateTransactions?.[0]?.estimates || [];
      const m = {};
      const eps = {};
      for (const e of rows) {
        if (e.quarter !== 0 || !DIV_YEARS.includes(e.year)) continue;
        if (e.dividend != null) m[e.year] = e.dividend;
        if (e.epsReported != null) eps[e.year] = e.epsReported;
      }
      if (Object.keys(m).length) divEstimates = m;
      if (Object.keys(eps).length) epsEstimates = eps;
    }

    if (!rec && !divEstimates && !epsEstimates) return;
    out[isin] = {
      rec,
      targetPrice: eur && est?.targetPrice != null ? est.targetPrice : null,
      recDate: est?.date ? String(est.date).slice(0, 10) : null,
      divEstimates, // { [year]: dividendPerShare }
      epsEstimates, // { [year]: epsReported } → P/E = price / EPS(current year)
    };
  });
}

export async function fetchRecs(isins) {
  const uniq = [...new Set((isins || []).filter(Boolean))];
  const out = {};
  const SIZE = 60;
  for (let i = 0; i < uniq.length; i += SIZE) {
    await fetchChunk(uniq.slice(i, i + SIZE), out);
  }
  return out;
}
