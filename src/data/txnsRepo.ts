// Persistence layer for transactions in Supabase (per-user table, RLS-guarded).
// Maps our camelCase Txn shape ↔ snake_case DB columns and dedupes by
// (user_id, txn_id) at the database via upsert.
import { supabase } from "../lib/supabase";
import type { Txn } from "./transactions";

interface TxnRow {
  user_id: string;
  txn_id: string;
  date: string | null;
  raw_type: string;
  category: string;
  name: string;
  ticker: string;
  isin: string;
  qty: number;
  price: number;
  fee: number;
  amount: number;
  acq_value: number;
  ccy: string;
}

const toRow = (t: Txn, userId: string): TxnRow => ({
  user_id: userId,
  txn_id: t.id,
  date: t.date || null,
  raw_type: t.rawType,
  category: t.category,
  name: t.name,
  ticker: t.ticker,
  isin: t.isin,
  qty: t.qty,
  price: t.price,
  fee: t.fee,
  amount: t.amount,
  acq_value: t.acqValue,
  ccy: t.ccy,
});

const fromRow = (r: TxnRow): Txn => ({
  id: r.txn_id,
  date: r.date || "",
  rawType: r.raw_type || "",
  category: (r.category || "other") as Txn["category"],
  name: r.name || "",
  ticker: r.ticker || "",
  isin: r.isin || "",
  qty: r.qty || 0,
  price: r.price || 0,
  fee: r.fee || 0,
  amount: r.amount || 0,
  acqValue: r.acq_value || 0,
  ccy: r.ccy || "EUR",
});

/** Load all transactions for the signed-in user. */
export async function loadTxns(userId: string): Promise<Txn[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: true });
  if (error) throw error;
  return (data || []).map(fromRow);
}

/** Delete all of a user's transactions (start over). */
export async function clearTxns(userId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("transactions").delete().eq("user_id", userId);
  if (error) throw error;
}

/**
 * Persist an imported batch.
 *  • mode "add"     → upsert (only genuinely new txn_ids land; existing untouched)
 *  • mode "refresh" → the file is the full truth: replace the user's whole ledger
 * Returns the resulting full transaction set.
 */
export async function saveTxns(userId: string, incoming: Txn[], mode: "add" | "refresh"): Promise<Txn[]> {
  if (!supabase) return incoming;
  const rows = incoming.map((t) => toRow(t, userId));
  if (mode === "refresh") {
    const { error: delErr } = await supabase.from("transactions").delete().eq("user_id", userId);
    if (delErr) throw delErr;
  }
  // upsert in chunks to stay well within request limits
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase.from("transactions").upsert(chunk, { onConflict: "user_id,txn_id" });
    if (error) throw error;
  }
  return loadTxns(userId);
}
