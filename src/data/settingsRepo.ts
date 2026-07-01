// Per-user settings (strategy text, target allocation, watchlist, notes) stored
// in the user_settings table (one JSON-ish row per user, RLS-guarded).
import { supabase } from "../lib/supabase";
import type { WatchEntry } from "../store/useStore";

export interface UserSettings {
  strategy: string;
  targets: Record<string, number | "">;
  watchlist: WatchEntry[];
  notes: Record<string, string>;
}

export async function loadSettings(userId: string): Promise<Partial<UserSettings> | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("user_settings")
    .select("strategy,targets,watchlist,notes")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    strategy: data.strategy ?? undefined,
    targets: (data.targets as UserSettings["targets"]) ?? undefined,
    watchlist: (data.watchlist as WatchEntry[]) ?? undefined,
    notes: (data.notes as Record<string, string>) ?? undefined,
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
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}
