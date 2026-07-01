// Live Inderes recommendations via the public Inderes GraphQL API (no auth).
// Batches many ISINs into one aliased query. Recommendation is an Int 1-5;
// target price is in researchCurrency (kept only when EUR to match the app).
const ENDPOINT = "https://www.inderes.fi/api/graphql";
const REC_ENUM = { 1: "SELL", 2: "REDUCE", 3: "HOLD", 4: "INCREASE", 5: "BUY" };

const F = "isin symbol researchCurrency estimateData { estimates { recommendation targetPrice date } }";

async function fetchChunk(chunk, out) {
  // one aliased GraphQL request for the chunk (i0, i1, …)
  const q = "query {" + chunk.map((isin, i) => `i${i}: instrument(isin:${JSON.stringify(isin)}){ ${F} }`).join(" ") + "}";
  let json;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Inderes AI Labs", "Accept-Languages": "en,fi,sv,da" },
      body: JSON.stringify({ query: q }),
    });
    json = await res.json();
  } catch {
    return; // network/best-effort
  }
  const data = json?.data || {};
  chunk.forEach((isin, i) => {
    const inst = data["i" + i];
    const est = inst?.estimateData?.estimates;
    if (!inst || !est || !est.recommendation) return;
    const eur = (inst.researchCurrency || "EUR") === "EUR";
    out[isin] = {
      rec: REC_ENUM[est.recommendation] || null,
      targetPrice: eur && est.targetPrice != null ? est.targetPrice : null,
      recDate: est.date ? String(est.date).slice(0, 10) : null,
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
