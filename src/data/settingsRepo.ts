// Per-user settings (strategy text, target allocation, watchlist, notes) stored
// in the user_settings table (one JSON-ish row per user, RLS-guarded).
import { supabase } from "../lib/supabase";
import type { WatchEntry, NotesMap } from "../store/useStore";

// Calculations-screen inputs + projection allocation mode.
export interface CalcPrefs {
  ret: Record<string, number | "">;
  monthly: number | "";
  years: number;
  target: number | "";
  allocMode: "target" | "current";
}

export interface UserSettings {
  strategy: string;
  targets: Record<string, number | "">;
  watchlist: WatchEntry[];
  notes: NotesMap;
  bench: string; // Overview benchmark selection
  calc: CalcPrefs | null; // Calculations inputs
  styleOverrides: Record<string, "active" | "passive">; // per-instrument active/passive overrides (by ISIN)
  stockStyles: Record<string, "growth" | "cyclical" | "defensive" | "neutral">; // per-stock company type (by ISIN)
}

export async function loadSettings(userId: string): Promise<Partial<UserSettings> | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("user_settings")
    .select("strategy,targets,watchlist,notes,bench,calc,style_overrides,stock_styles")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    strategy: data.strategy ?? undefined,
    targets: (data.targets as UserSettings["targets"]) ?? undefined,
    watchlist: (data.watchlist as WatchEntry[]) ?? undefined,
    notes: (data.notes as NotesMap) ?? undefined,
    bench: (data.bench as string) ?? undefined,
    calc: (data.calc as CalcPrefs) ?? undefined,
    styleOverrides: (data.style_overrides as UserSettings["styleOverrides"]) ?? undefined,
    stockStyles: (data.stock_styles as UserSettings["stockStyles"]) ?? undefined,
  };
}

export async function saveSettings(userId: string, s: UserSettings): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      strategy: s.strategy,
      targets: s.targets,
      watchlist: s.watchlist,
      notes: s.notes,
      bench: s.bench,
      calc: s.calc,
      style_overrides: s.styleOverrides,
      stock_styles: s.stockStyles,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}
