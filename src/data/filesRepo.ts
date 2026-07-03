// Company attachments in Supabase STORAGE (not the Postgres database — object
// storage is the right home for binary files). Layout, one file per object:
//   company-files/{userId}/{ticker}/{scope}/{timestamp}__{filename}
// where scope is "general" (the asset page) or "note-{noteId}" (a posted note).
// Storage policies restrict every user to their own {userId}/ folder.
import { supabase } from "../lib/supabase";

export const FILES_BUCKET = "company-files";
export const MAX_FILE_MB = 10;

export interface CompanyFile {
  path: string; // full object path (for download/delete)
  name: string; // display name (original filename)
  scope: string; // "general" | "note-<id>"
  size: number; // bytes
  createdAt: string;
}

const safePart = (s: string) => s.replace(/[^\w.\-() ]/g, "_");
const baseOf = (uid: string, ticker: string) => `${uid}/${safePart(ticker)}`;

/** All attachments for a company, grouped by scope. */
export async function listCompanyFiles(uid: string, ticker: string): Promise<Record<string, CompanyFile[]>> {
  if (!supabase) return {};
  const base = baseOf(uid, ticker);
  const out: Record<string, CompanyFile[]> = {};
  const { data: entries, error } = await supabase.storage.from(FILES_BUCKET).list(base, { limit: 100 });
  if (error || !entries) return out;
  const folders = entries.filter((e) => !e.id).map((e) => e.name); // id === null → subfolder
  for (const scope of folders) {
    const { data: files } = await supabase.storage.from(FILES_BUCKET).list(`${base}/${scope}`, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    out[scope] = (files || [])
      .filter((f) => f.id)
      .map((f) => ({
        path: `${base}/${scope}/${f.name}`,
        name: f.name.includes("__") ? f.name.slice(f.name.indexOf("__") + 2) : f.name,
        scope,
        size: (f.metadata as { size?: number } | null)?.size ?? 0,
        createdAt: f.created_at || "",
      }));
  }
  return out;
}

/** Upload one file into a scope. Throws with a readable message on failure. */
export async function uploadCompanyFile(uid: string, ticker: string, scope: string, file: File): Promise<void> {
  if (!supabase) throw new Error("Storage requires a signed-in account.");
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`File is larger than ${MAX_FILE_MB} MB.`);
  const path = `${baseOf(uid, ticker)}/${scope}/${Date.now()}__${safePart(file.name)}`;
  const { error } = await supabase.storage.from(FILES_BUCKET).upload(path, file, { contentType: file.type || undefined });
  if (error) throw new Error(error.message);
}

export async function deleteCompanyFile(path: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.storage.from(FILES_BUCKET).remove([path]);
  if (error) throw new Error(error.message);
}

/** Best-effort removal of every attachment in a scope (used when a note is deleted). */
export async function deleteScopeFiles(uid: string, ticker: string, scope: string): Promise<void> {
  if (!supabase) return;
  const base = `${baseOf(uid, ticker)}/${scope}`;
  const { data: files } = await supabase.storage.from(FILES_BUCKET).list(base, { limit: 100 });
  const paths = (files || []).filter((f) => f.id).map((f) => `${base}/${f.name}`);
  if (paths.length) await supabase.storage.from(FILES_BUCKET).remove(paths);
}

/** Short-lived signed URL for downloading a private object. */
export async function fileUrl(path: string): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.storage.from(FILES_BUCKET).createSignedUrl(path, 120);
  return data?.signedUrl ?? null;
}
