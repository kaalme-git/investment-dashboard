// Vercel Cron: refresh Inderes recommendations for CURRENTLY-HELD stocks only
// (union across all users), at 10:00 Helsinki on weekdays (see vercel.json).
//
// Design notes:
//  • Held = net share qty > 0 reconstructed from transactions (service key reads all).
//  • We also refresh any rec row sharing a Yahoo symbol with a held stock, so a
//    holding whose ISIN changed (corporate action) still resolves its rec.
//  • AUTHORITATIVE: each run sets rec to Inderes' current value — or CLEARS it if
//    the stock is no longer covered. So coverage changes are handled automatically
//    with no maintained coverage list (it's discovered live, per stock, each run).
import { createClient } from "@supabase/supabase-js";
import { fetchRecs } from "./_lib/inderes.mjs";

const sign = (c) => (c === "buy" || c === "transfer_in" ? 1 : c === "sell" || c === "transfer_out" ? -1 : 0);

export default async function handler(_req, res) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) { res.status(200).json({ ok: false, reason: "no supabase env" }); return; }
  try {
    const db = createClient(url, key, { auth: { persistSession: false } });

    // 1) currently-held ISINs across all users (net qty > 0)
    const net = {};
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db.from("transactions").select("isin,category,qty").range(from, from + PAGE - 1);
      if (error || !data || !data.length) break;
      for (const t of data) { const s = sign(t.category); if (s && t.isin) net[t.isin] = (net[t.isin] || 0) + s * (t.qty || 0); }
      if (data.length < PAGE) break;
    }
    const held = Object.keys(net).filter((i) => net[i] > 1e-6);
    if (!held.length) { res.status(200).json({ ok: true, held: 0 }); return; }

    // 2) expand to renamed-ISIN siblings (rows sharing a Yahoo symbol with a held stock)
    const { data: heldRows } = await db.from("instrument_meta").select("isin,symbol").in("isin", held);
    const heldSyms = [...new Set((heldRows || []).map((r) => r.symbol).filter(Boolean))];
    let sibs = [];
    if (heldSyms.length) {
      const { data } = await db.from("instrument_meta").select("isin").in("symbol", heldSyms);
      sibs = (data || []).map((r) => r.isin);
    }
    const target = [...new Set([...held, ...sibs])];

    // 3) fetch live recs + dividend estimates, then 4) upsert authoritatively
    const recs = await fetchRecs(target);
    const stamp = new Date().toISOString();
    const rows = target.map((isin) => {
      const r = recs[isin];
      return {
        isin,
        rec: r?.rec ?? null,
        target_price: r?.targetPrice ?? null,
        rec_date: r?.recDate ?? null,
        div_estimates: r?.divEstimates ?? null, // DPS estimates for T, T+1, T+2
        eps_estimates: r?.epsEstimates ?? null, // EPS estimates for T, T+1, T+2 (→ P/E)
        rec_updated_at: stamp,
      };
    });
    for (let i = 0; i < rows.length; i += 200) {
      await db.from("instrument_meta").upsert(rows.slice(i, i + 200), { onConflict: "isin" });
    }
    const withRec = target.filter((i) => recs[i]?.rec).length;
    res.status(200).json({ ok: true, held: held.length, refreshed: target.length, withRec, at: stamp });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e?.message || e) });
  }
}
