// Supabase browser client. Reads the project URL + publishable key from Vite env
// (.env.local). Safe to expose — all data access is guarded by row-level security.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLIC_KEY as string | undefined;

/** True when the app is configured to use Supabase (accounts + cloud storage). */
export const supabaseEnabled = Boolean(url && key);

export const supabase = supabaseEnabled
  ? createClient(url as string, key as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
