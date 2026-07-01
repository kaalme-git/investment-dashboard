// Vercel serverless function: GET/POST /api/prices
//   GET  /api/prices?isins=FI...,LU...&start=2021-06-01[&force=1]
//   POST /api/prices           body: { isins: [...], start?, force? }
// Backed by the shared Supabase price cache (incremental, EUR-normalized).
import { resolvePrices } from "./_lib/cache.mjs";

export default async function handler(req, res) {
  try {
    let isins = [];
    let start = "2021-06-01";
    let force = false;
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      isins = body.isins || [];
      if (body.start) start = body.start;
      force = !!body.force;
    } else {
      isins = String(req.query?.isins || "").split(",").map((s) => s.trim()).filter(Boolean);
      if (req.query?.start) start = String(req.query.start);
      force = req.query?.force === "1" || req.query?.force === "true";
    }
    if (!isins.length) { res.status(400).json({ error: "no isins" }); return; }
    const data = await resolvePrices(isins, start, force);
    res.status(200).json({ data, generatedAt: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
