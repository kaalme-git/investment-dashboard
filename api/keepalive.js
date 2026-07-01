// Daily Vercel Cron target. Touches the Supabase database so a free-tier project
// never hits the 7-day inactivity pause. Configured in vercel.json → crons.
import { createClient } from "@supabase/supabase-js";

export default async function handler(_req, res) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) { res.status(200).json({ ok: false, reason: "no supabase env" }); return; }
  try {
    const db = createClient(url, key, { auth: { persistSession: false } });
    await db.from("instrument_meta").select("isin", { head: true, count: "exact" });
    res.status(200).json({ ok: true, at: new Date().toISOString() });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e?.message || e) });
  }
}
