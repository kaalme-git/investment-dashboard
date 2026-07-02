import { create } from "zustand";
import type { AllocDim } from "../data/types";
import type { TrendPeriod } from "../data/portfolio";
import { parseCsv, type Txn } from "../data/transactions";
import { REAL_TXNS_CSV } from "../data/realTxns";
import { buildPortfolio, BENCH_SYMBOL, type Portfolio, type PriceMap, type StyleOverrides } from "../data/live";

/** User-set company type for the Analysis tab (per individual stock).
 *  "neutral" is a deliberate label: counts as classified, average in both scales. */
export type StockStyle = "growth" | "cyclical" | "defensive" | "neutral";
import { supabase, supabaseEnabled } from "../lib/supabase";
import { loadTxns as dbLoadTxns, saveTxns as dbSaveTxns, clearTxns as dbClearTxns } from "../data/txnsRepo";
import { loadSettings as dbLoadSettings, saveSettings as dbSaveSettings } from "../data/settingsRepo";
import type { User } from "@supabase/supabase-js";
import type { ResTab } from "../data/research";

// When Supabase isn't configured the app falls back to a single-user local mode
// (transactions in localStorage, no login) so local dev still works.
const LOCAL_MODE = !supabaseEnabled;

// ---- persistence helpers (transactions + fetched prices survive reloads) ----
const LS_TXNS = "pf_txns";
const LS_PRICES = "pf_prices_v5"; // bump to invalidate caches (v5: EPS estimates + trailing P/E)
const PRICE_TTL = 6 * 60 * 60 * 1000; // don't auto-refresh prices more than every 6h on reload; the Refresh button forces it, and the server cache throttles Yahoo further

function dedupeTxns(txns: Txn[]): Txn[] {
  const seen = new Set<string>();
  const out: Txn[] = [];
  for (const t of txns) {
    if (t.id && seen.has(t.id)) continue;
    if (t.id) seen.add(t.id);
    out.push(t);
  }
  return out;
}
function loadTxns(): Txn[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_TXNS) || "null");
    if (Array.isArray(raw) && raw.length) return raw as Txn[];
  } catch { /* ignore */ }
  return dedupeTxns(parseCsv(REAL_TXNS_CSV));
}
function persistTxns(txns: Txn[]) {
  try { localStorage.setItem(LS_TXNS, JSON.stringify(txns)); } catch { /* ignore */ }
}
function loadPrices(): { prices: PriceMap; fetchedAt: number | null } {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_PRICES) || "null");
    if (raw && raw.prices) return { prices: raw.prices, fetchedAt: raw.fetchedAt || null };
  } catch { /* ignore */ }
  return { prices: {}, fetchedAt: null };
}
function persistPrices(prices: PriceMap, fetchedAt: number) {
  try { localStorage.setItem(LS_PRICES, JSON.stringify({ prices, fetchedAt })); } catch { /* ignore */ }
}

export interface PendingImport {
  txns: Txn[];
  name: string;
  message: string;
}

// Heuristic: does an uploaded file look like a DIFFERENT portfolio than the
// existing history? True when it shares no transaction Ids and almost no
// instruments with what's already loaded (so merging would mix two portfolios).
function differentPortfolioWarning(parsed: Txn[], existing: Txn[]): string | null {
  if (!existing.length || !parsed.length) return null;
  const exIds = new Set(existing.map((t) => t.id));
  if (parsed.some((t) => exIds.has(t.id))) return null; // shares transactions → same account / incremental
  const exIsins = new Set(existing.map((t) => t.isin).filter(Boolean));
  const newIsins = [...new Set(parsed.map((t) => t.isin).filter(Boolean))];
  if (!newIsins.length) return null;
  const shared = newIsins.filter((i) => exIsins.has(i)).length;
  if (shared / newIsins.length >= 0.34) return null; // enough overlap → same portfolio
  return `This file shares no transactions with your existing history and ${shared === 0 ? "none" : "few"} of its instruments match your current holdings — it looks like a different portfolio.`;
}

/** Outcome of the last CSV upload, shown in the Import card. */
export interface ImportResult {
  ok: boolean;
  fileName: string;
  message: string; // headline (e.g. "Import successful")
  added?: number; // genuinely new transactions
  skipped?: number; // rows already in the account (deduplicated)
  total?: number; // transactions in the account after the import
  range?: string; // date span covered by the uploaded file
}

const importSummary = (parsed: Txn[], added: number, total: number, name: string, replace: boolean): ImportResult => {
  const dates = parsed.map((t) => t.date).filter(Boolean).sort();
  return {
    ok: true,
    fileName: name,
    message: replace ? "History replaced" : added > 0 ? "Import successful" : "Nothing new to import",
    added,
    skipped: Math.max(0, parsed.length - added),
    total,
    range: dates.length ? dates[0] + " → " + dates[dates.length - 1] : undefined,
  };
};

// Commit an imported batch: merge (dedupe by Id) or replace-all. Handles both
// the signed-in (Supabase) and local-mode (localStorage) paths.
async function commitTxns(
  set: (p: Partial<DashState>) => void,
  get: () => DashState,
  parsed: Txn[],
  name: string,
  replace: boolean,
) {
  if (!LOCAL_MODE && get().user) {
    set({ dataLoading: true, authError: null });
    try {
      const before = replace ? 0 : get().txns.length;
      const merged = await dbSaveTxns(get().user!.id, parsed, replace ? "refresh" : "add");
      set({
        txns: merged,
        dataLoading: false,
        pendingImport: null,
        txFile: name + " · " + (replace ? "replaced — " : "") + merged.length + " transactions in account",
        importResult: importSummary(parsed, merged.length - before, merged.length, name, replace),
        portfolio: buildPortfolio(merged, get().prices, get().styleOverrides),
      });
      void get().fetchPrices(true);
    } catch (e) {
      set({
        dataLoading: false,
        importResult: { ok: false, fileName: name, message: "Import failed: " + String((e as Error)?.message || e) },
      });
    }
    return;
  }
  const base = replace ? [] : get().txns;
  const merged = dedupeTxns([...base, ...parsed]);
  persistTxns(merged);
  set({
    txns: merged,
    pendingImport: null,
    txFile: name + " · " + merged.length + " transactions",
    importResult: importSummary(parsed, merged.length - base.length, merged.length, name, replace),
    portfolio: buildPortfolio(merged, get().prices),
  });
  void get().fetchPrices(true);
}

// Debounced save of the signed-in user's settings (strategy/targets/watchlist/notes).
let settingsTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSettingsSave(get: () => DashState) {
  if (LOCAL_MODE) return;
  const u = get().user;
  if (!u) return;
  if (settingsTimer) clearTimeout(settingsTimer);
  settingsTimer = setTimeout(() => {
    const s = get();
    void dbSaveSettings(u.id, {
      strategy: s.strategyText,
      targets: s.targets,
      watchlist: s.watchlist,
      notes: s.notes,
      bench: s.bench,
      styleOverrides: s.styleOverrides,
      stockStyles: s.stockStyles,
      depositExclusions: s.depositExclusions,
      calc: {
        ret: s.calcRet,
        monthly: s.calcMonthly,
        years: s.calcYears,
        target: s.calcTarget,
        allocMode: s.calcAllocMode,
      },
    }).catch(() => {});
  }, 700);
}

interface AiState {
  prompt: string;
  answer: string;
  loading: boolean;
  asked: boolean;
}

export interface WatchEntry {
  ticker: string;
  name: string;
}

// ---- localStorage helpers (watchlist + notes persist across re-imports) ----
const DEFAULT_WATCH: WatchEntry[] = [
  { ticker: "EVO", name: "Evolution AB" },
  { ticker: "NVDA", name: "NVIDIA" },
  { ticker: "INVEB", name: "Investor B" },
];

function loadWatch(): WatchEntry[] {
  try {
    const wl = JSON.parse(localStorage.getItem("pf_watchlist") || "null");
    if (Array.isArray(wl)) return wl;
  } catch {
    /* ignore */
  }
  return DEFAULT_WATCH;
}
const DEFAULT_STRATEGY = `Long-term, growth-oriented portfolio with a 10+ year horizon. Core holdings are broad, low-cost index funds and ETFs (passive); satellite positions are high-conviction Nordic and global quality stocks (active).

I favour profitable, cash-generative, dividend-paying companies and trim names Inderes rates Reduce or Sell. Fixed income and alternatives provide ballast; I keep 5–10% cash for opportunities.

Target ~70% equities. Rebalance when any asset class drifts more than 5pp from target. No single position above 15% of the portfolio.`;

// A single posted note on a company, saved under the user's account.
export interface NoteEntry {
  id: string;
  ts: number; // posted-at (ms)
  text: string;
}
export type NotesMap = Record<string, NoteEntry[]>;

export function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
}

// Accept both the new shape (arrays of notes) and the legacy shape (one string
// per company) and normalise to NotesMap so older saved notes aren't lost.
export function normalizeNotes(raw: unknown): NotesMap {
  const out: NotesMap = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [ticker, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") {
      if (v.trim()) out[ticker] = [{ id: newId(), ts: 0, text: v.trim() }];
    } else if (Array.isArray(v)) {
      const list = v
        .filter((n) => n && typeof (n as NoteEntry).text === "string" && (n as NoteEntry).text.trim())
        .map((n) => ({ id: (n as NoteEntry).id || newId(), ts: (n as NoteEntry).ts || 0, text: (n as NoteEntry).text }));
      if (list.length) out[ticker] = list;
    }
  }
  return out;
}

function loadNotes(): NotesMap {
  try {
    return normalizeNotes(JSON.parse(localStorage.getItem("pf_notes") || "null"));
  } catch {
    return {};
  }
}

interface DashState {
  // dashboard controls
  bench: string;
  styleOverrides: StyleOverrides; // per-instrument active/passive overrides (by ISIN)
  stockStyles: Record<string, StockStyle>; // per-stock Growth/Cyclical/Defensive label (by ISIN)
  // transactions marked "not a real deposit/withdrawal" (e.g. an IPO subscription
  // payment) — excluded from the net-deposits chart & summary figure ONLY; the
  // return engine (buildPortfolio/buildTWR) never sees this map.
  depositExclusions: Record<string, true>; // keyed by transaction id
  period: TrendPeriod;
  allocMode: AllocDim;
  hoverAlloc: number | null;
  allocSelected: number | null; // bucket clicked open in the Allocation drill-down
  hoverPerf: number | null;

  // performance chart — which instrument groups to include in the return
  perfGroups: { stocks: boolean; eqFunds: boolean; fiFunds: boolean; other: boolean; cash: boolean };
  togglePerfGroup: (g: "stocks" | "eqFunds" | "fiFunds" | "other" | "cash") => void;

  // ai box (stubbed until the serverless proxy is wired)
  ai: AiState;

  // transactions
  txns: Txn[];
  txFile: string;
  pendingImport: PendingImport | null; // set when an upload looks like a different portfolio
  importResult: ImportResult | null; // outcome of the last upload (shown in the Import card)

  // auth / account
  user: User | null;
  authReady: boolean; // initial session check finished
  authError: string | null;
  authBusy: boolean;
  authNotice: string | null; // transient success message (e.g. "reset link sent")
  recovering: boolean; // arrived via a password-reset link → show set-new-password
  dataLoading: boolean; // loading this user's transactions from the DB
  localMode: boolean; // true when Supabase is not configured
  initAuth: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  loadUserData: () => Promise<void>;

  // live prices + the computed portfolio model
  prices: PriceMap;
  pricesFetchedAt: number | null;
  pricesLoading: boolean;
  pricesError: string | null;
  portfolio: Portfolio;
  fetchPrices: (force?: boolean) => Promise<void>;

  // watchlist + notes
  watchlist: WatchEntry[];
  notes: NotesMap;
  wlTicker: string;
  wlName: string;

  // research
  resTab: ResTab;

  // strategy
  strategyText: string;
  targets: Record<string, number | "">;

  // calculations
  calcRet: Record<string, number | "">;
  calcMonthly: number | "";
  calcYears: number;
  calcTarget: number | "";
  calcHover: number | null;
  calcAllocMode: "target" | "current"; // which allocation drives the projection

  setBench: (b: string) => void;
  setStyleOverride: (isin: string, v: "active" | "passive" | null) => void;
  setStockStyle: (isin: string, v: StockStyle | null) => void;
  toggleDepositExclusion: (txnId: string) => void;
  setPeriod: (p: TrendPeriod) => void;
  setAllocMode: (m: AllocDim) => void;
  setHoverAlloc: (i: number | null) => void;
  setAllocSelected: (i: number | null) => void;
  setHoverPerf: (i: number | null) => void;

  setAiPrompt: (q: string) => void;
  askAi: (q?: string) => void;

  importCsv: (text: string, name: string) => Promise<void>;
  resolveImport: (action: "replace" | "merge" | "cancel") => Promise<void>;
  clearAllTxns: () => Promise<void>;

  setResTab: (t: ResTab) => void;

  setStrategyText: (v: string) => void;
  setTarget: (label: string, raw: string) => void;
  setCalcRet: (label: string, raw: string) => void;
  setCalcMonthly: (raw: string) => void;
  setCalcYears: (y: number) => void;
  setCalcTarget: (raw: string) => void;
  setCalcHover: (i: number | null) => void;
  setCalcAllocMode: (m: "target" | "current") => void;

  setWlTicker: (v: string) => void;
  setWlName: (v: string) => void;
  addWatch: () => void;
  addWatchTicker: (ticker: string, name?: string) => void;
  removeWatch: (ticker: string) => void;
  addNote: (ticker: string, text: string) => void;
  removeNote: (ticker: string, id: string) => void;
}

// In local mode we seed from localStorage / the baked export; with accounts we
// start empty and load the signed-in user's transactions from the DB.
const INITIAL_TXNS = LOCAL_MODE ? loadTxns() : [];
const INITIAL_PRICES = loadPrices();

export const useStore = create<DashState>((set, get) => ({
  bench: "OMXH25",
  styleOverrides: {},
  stockStyles: {},
  depositExclusions: {},
  period: "1Y",
  allocMode: "asset",
  hoverAlloc: null,
  allocSelected: null,
  hoverPerf: null,

  perfGroups: { stocks: true, eqFunds: true, fiFunds: true, other: true, cash: true },
  togglePerfGroup: (g) => set((s) => ({ perfGroups: { ...s.perfGroups, [g]: !s.perfGroups[g] } })),

  ai: { prompt: "", answer: "", loading: false, asked: false },

  txns: INITIAL_TXNS,
  pendingImport: null,
  importResult: null,
  txFile: LOCAL_MODE
    ? "transactions-and-notes-export.csv · loaded from your Nordnet export"
    : "No transactions yet — upload your Nordnet CSV",

  // ---- auth ----
  user: null,
  authReady: LOCAL_MODE,
  authError: null,
  authBusy: false,
  authNotice: null,
  recovering: false,
  dataLoading: false,
  localMode: LOCAL_MODE,
  initAuth: () => {
    if (LOCAL_MODE || !supabase) {
      set({ authReady: true });
      void get().fetchPrices();
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      set({ user: u, authReady: true });
      if (u) void get().loadUserData();
    });
    supabase.auth.onAuthStateChange((evt, session) => {
      const u = session?.user ?? null;
      const prevId = get().user?.id;
      set({ user: u });
      if (evt === "PASSWORD_RECOVERY") set({ recovering: true });
      if (u && u.id !== prevId) void get().loadUserData();
      if (!u) set({ txns: [], portfolio: buildPortfolio([], get().prices), txFile: "No transactions yet — upload your Nordnet CSV" });
    });
  },
  signIn: async (email, password) => {
    if (!supabase) return;
    set({ authBusy: true, authError: null });
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    set({ authBusy: false });
    if (error) set({ authError: error.message });
  },
  signUp: async (email, password) => {
    if (!supabase) return;
    set({ authBusy: true, authError: null });
    const { error } = await supabase.auth.signUp({ email: email.trim(), password });
    set({ authBusy: false });
    if (error) set({ authError: error.message });
  },
  signOut: async () => {
    if (supabase) await supabase.auth.signOut();
  },
  resetPassword: async (email) => {
    if (!supabase) return;
    set({ authBusy: true, authError: null, authNotice: null });
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    set({ authBusy: false });
    if (error) set({ authError: error.message });
    else set({ authNotice: "If an account exists for that email, a password-reset link is on its way. Check your inbox." });
  },
  updatePassword: async (password) => {
    if (!supabase) return;
    set({ authBusy: true, authError: null });
    const { error } = await supabase.auth.updateUser({ password });
    set({ authBusy: false });
    if (error) { set({ authError: error.message }); return; }
    set({ recovering: false, authNotice: null });
  },
  loadUserData: async () => {
    const u = get().user;
    if (!u) return;
    set({ dataLoading: true });
    try {
      const [txns, settings] = await Promise.all([dbLoadTxns(u.id), dbLoadSettings(u.id).catch(() => null)]);
      // legacy asset-class key: settings saved before the rename used "Alternatives"
      // where the bucket is now called "Other" (targets + expected returns)
      const renameAlt = <T,>(o: Record<string, T> | undefined): Record<string, T> | undefined => {
        if (!o || !("Alternatives" in o) || "Other" in o) return o;
        const { Alternatives, ...rest } = o;
        return { ...rest, Other: Alternatives };
      };
      set((s) => ({
        txns,
        dataLoading: false,
        txFile: txns.length ? txns.length + " transactions in your account" : "No transactions yet — upload your Nordnet CSV",
        portfolio: buildPortfolio(txns, get().prices, settings?.styleOverrides ?? s.styleOverrides),
        // apply saved settings (fall back to existing defaults for any missing field)
        styleOverrides: settings?.styleOverrides ?? s.styleOverrides,
        stockStyles: settings?.stockStyles ?? s.stockStyles,
        depositExclusions: settings?.depositExclusions ?? s.depositExclusions,
        strategyText: settings?.strategy ?? s.strategyText,
        targets: renameAlt(settings?.targets) ?? s.targets,
        watchlist: settings?.watchlist ?? s.watchlist,
        notes: settings?.notes ? normalizeNotes(settings.notes) : s.notes,
        bench: settings?.bench ?? s.bench,
        calcRet: renameAlt(settings?.calc?.ret) ?? s.calcRet,
        calcMonthly: settings?.calc?.monthly ?? s.calcMonthly,
        // snap any previously-saved horizon that's no longer an option (was 5/20) to the 30y default
        calcYears: [10, 30, 50].includes(settings?.calc?.years as number) ? (settings!.calc!.years as number) : 30,
        calcTarget: settings?.calc?.target ?? s.calcTarget,
        calcAllocMode: settings?.calc?.allocMode ?? s.calcAllocMode,
      }));
      // respect the cache on load — only refetch if prices are stale (PRICE_TTL);
      // the Refresh button forces an update on demand.
      void get().fetchPrices(false);
    } catch (e) {
      set({ dataLoading: false, authError: "Could not load your data: " + String((e as Error)?.message || e) });
    }
  },

  prices: INITIAL_PRICES.prices,
  pricesFetchedAt: INITIAL_PRICES.fetchedAt,
  pricesLoading: false,
  pricesError: null,
  portfolio: buildPortfolio(INITIAL_TXNS, INITIAL_PRICES.prices),
  fetchPrices: async (force) => {
    if (get().pricesLoading) return;
    const age = get().pricesFetchedAt ? Date.now() - (get().pricesFetchedAt as number) : Infinity;
    if (!force && age < PRICE_TTL && Object.keys(get().prices).length) return; // still fresh
    const txns = get().txns;
    const isins = [...new Set(txns.map((t) => t.isin).filter(Boolean))];
    if (!isins.length) return;
    const dates = txns.map((t) => t.date).filter(Boolean).sort();
    const start = dates[0] || "2021-06-01";
    const all = [...isins, ...Object.values(BENCH_SYMBOL)];
    set({ pricesLoading: true, pricesError: null });
    try {
      const res = await fetch("/api/prices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isins: all, start, force: !!force }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const j = await res.json();
      const prices = { ...get().prices, ...(j.data || {}) };
      const fetchedAt = Date.now();
      persistPrices(prices, fetchedAt);
      set({ prices, pricesFetchedAt: fetchedAt, pricesLoading: false, portfolio: buildPortfolio(get().txns, prices, get().styleOverrides) });
    } catch (e) {
      set({ pricesLoading: false, pricesError: String((e as Error)?.message || e) });
    }
  },

  watchlist: loadWatch(),
  notes: loadNotes(),
  wlTicker: "",
  wlName: "",

  resTab: "equity",

  strategyText: DEFAULT_STRATEGY,
  targets: { Equities: 70, "Fixed income": 10, Other: 10, "Cash & equivalent": 10, Active: 30, Passive: 70 },

  calcRet: { Equities: 7, "Fixed income": 3, Other: 5, "Cash & equivalent": 2 },
  calcMonthly: 500,
  calcYears: 30,
  calcTarget: 1000000,
  calcHover: null,
  calcAllocMode: "target",

  setBench: (b) => { set({ bench: b }); scheduleSettingsSave(get); },
  setStyleOverride: (isin, v) => {
    if (!isin) return;
    const next = { ...get().styleOverrides };
    if (v === null) delete next[isin];
    else next[isin] = v;
    set({ styleOverrides: next, portfolio: buildPortfolio(get().txns, get().prices, next) });
    scheduleSettingsSave(get);
  },
  setStockStyle: (isin, v) => {
    if (!isin) return;
    const next = { ...get().stockStyles };
    if (v === null) delete next[isin];
    else next[isin] = v;
    set({ stockStyles: next }); // analysis composes in the tab — no portfolio rebuild needed
    scheduleSettingsSave(get);
  },
  toggleDepositExclusion: (txnId) => {
    if (!txnId) return;
    const next = { ...get().depositExclusions };
    if (next[txnId]) delete next[txnId];
    else next[txnId] = true;
    set({ depositExclusions: next }); // display-only (deposits chart + summary); returns unaffected
    scheduleSettingsSave(get);
  },
  setPeriod: (p) => set({ period: p }),
  setAllocMode: (m) => set({ allocMode: m, allocSelected: null }), // bucket indices differ per view
  setHoverAlloc: (i) => set({ hoverAlloc: i }),
  setAllocSelected: (i) => set((s) => ({ allocSelected: s.allocSelected === i ? null : i })), // toggle
  setHoverPerf: (i) => set({ hoverPerf: i }),

  setAiPrompt: (q) => set((s) => ({ ai: { ...s.ai, prompt: q } })),

  // Real assistant: POST /api/ask (Groq free tier, server-side key) with a compact
  // snapshot of the live portfolio as grounding + the Supabase session token so
  // only signed-in users can spend the shared free-tier quota.
  askAi: (q) => {
    const prompt = (q ?? get().ai.prompt).trim();
    if (!prompt || get().ai.loading) return;
    set({ ai: { prompt, answer: "", loading: true, asked: true } });
    void (async () => {
      const fail = (msg: string) => set((s) => ({ ai: { ...s.ai, loading: false, answer: msg } }));
      try {
        const p = get().portfolio;
        const st = get();
        const context = {
          asOf: new Date().toISOString().slice(0, 10),
          kpis: p.kpis.map((k) => ({ label: k.label, value: k.value })),
          holdings: p.holdingsGroups.flatMap((g) =>
            g.rows.map((r) => ({
              group: g.label, ticker: r.ticker, name: r.name, type: r.typeLbl, sector: r.sector,
              value: r.valueStr, weight: r.weightStr, totalReturn: r.totalStr, fwdDivYield: r.yieldStr, inderesRec: r.recShort,
            })),
          ),
          allocationPct: {
            sector: p.allocMap.sector.map((x) => ({ label: x.label, pct: x.pctStr })),
            region: p.allocMap.region.map((x) => ({ label: x.label, pct: x.pctStr })),
            asset: p.allocMap.asset.map((x) => ({ label: x.label, pct: x.pctStr })),
            style: p.allocMap.style.map((x) => ({ label: x.label, pct: x.pctStr })),
          },
          stockAnalysis: p.analysisStocks.map((a) => ({
            ticker: a.ticker, pe: a.pe, peSource: a.peSrc, weightOfStocks: a.weightStr,
            companyType: st.stockStyles[a.isin] ?? "unclassified",
          })),
          dividendsByYear: p.dividends,
          targetAllocation: st.targets,
          strategy: (st.strategyText || "").slice(0, 1500),
        };
        const headers: Record<string, string> = { "content-type": "application/json" };
        if (supabase) {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (token) headers.Authorization = "Bearer " + token;
        }
        const res = await fetch("/api/ask", { method: "POST", headers, body: JSON.stringify({ question: prompt, context }) });
        const j = (await res.json().catch(() => ({}))) as { answer?: string; error?: string };
        if (res.ok && j.answer) set((s) => ({ ai: { ...s.ai, loading: false, answer: j.answer as string } }));
        else fail(j.error || "The assistant is unavailable right now — please try again.");
      } catch {
        fail("The assistant is unavailable right now — please try again.");
      }
    })();
  },

  // Upload merges by transaction Id (safe for full or partial exports). If the
  // file looks like a different portfolio, hold it and ask the user what to do.
  importCsv: async (text, name) => {
    const parsed = dedupeTxns(parseCsv(text));
    if (!parsed.length) {
      set({
        txFile: name + " · no valid transaction rows found",
        pendingImport: null,
        importResult: { ok: false, fileName: name, message: "No transactions found — is this a Nordnet transactions export (.csv)?" },
      });
      return;
    }
    const warn = differentPortfolioWarning(parsed, get().txns);
    if (warn) { set({ pendingImport: { txns: parsed, name, message: warn }, importResult: null }); return; }
    await commitTxns(set, get, parsed, name, false);
  },
  resolveImport: async (action) => {
    const p = get().pendingImport;
    if (!p) return;
    if (action === "cancel") { set({ pendingImport: null, importResult: null }); return; }
    await commitTxns(set, get, p.txns, p.name, action === "replace");
  },
  clearAllTxns: async () => {
    if (!LOCAL_MODE && get().user) {
      set({ dataLoading: true });
      try { await dbClearTxns(get().user!.id); } catch (e) { set({ authError: "Could not clear: " + String((e as Error)?.message || e) }); }
    } else {
      persistTxns([]);
    }
    set({
      txns: [],
      dataLoading: false,
      pendingImport: null,
      importResult: null,
      txFile: "No transactions yet — upload your Nordnet CSV",
      portfolio: buildPortfolio([], get().prices),
    });
  },

  setResTab: (t) => set({ resTab: t }),

  setStrategyText: (v) => { set({ strategyText: v }); scheduleSettingsSave(get); },
  setTarget: (label, raw) => {
    const v = raw === "" ? "" : parseFloat(raw);
    set((s) => ({ targets: { ...s.targets, [label]: typeof v === "number" && isNaN(v) ? "" : v } }));
    scheduleSettingsSave(get);
  },
  setCalcRet: (label, raw) => {
    const v = raw === "" ? "" : parseFloat(raw);
    set((s) => ({ calcRet: { ...s.calcRet, [label]: typeof v === "number" && isNaN(v) ? "" : v } }));
    scheduleSettingsSave(get);
  },
  setCalcMonthly: (raw) => {
    const v = raw === "" ? "" : parseFloat(raw);
    set({ calcMonthly: typeof v === "number" && isNaN(v) ? "" : v });
    scheduleSettingsSave(get);
  },
  setCalcYears: (y) => { set({ calcYears: y }); scheduleSettingsSave(get); },
  setCalcTarget: (raw) => {
    const digits = ("" + raw).replace(/[^0-9]/g, "");
    set({ calcTarget: digits === "" ? "" : parseInt(digits, 10) });
    scheduleSettingsSave(get);
  },
  setCalcHover: (i) => set({ calcHover: i }),
  setCalcAllocMode: (m) => { set({ calcAllocMode: m }); scheduleSettingsSave(get); },

  setWlTicker: (v) => set({ wlTicker: v }),
  setWlName: (v) => set({ wlName: v }),
  addWatch: () => {
    const t = (get().wlTicker || "").trim().toUpperCase();
    if (!t) return;
    const wl = get().watchlist.slice();
    if (!wl.some((w) => w.ticker === t)) wl.push({ ticker: t, name: (get().wlName || "").trim() || t });
    persistWatch(wl);
    set({ watchlist: wl, wlTicker: "", wlName: "" });
    scheduleSettingsSave(get);
  },
  addWatchTicker: (ticker, name) => {
    const wl = get().watchlist.slice();
    if (!wl.some((w) => w.ticker === ticker)) wl.push({ ticker, name: name || ticker });
    persistWatch(wl);
    set({ watchlist: wl });
    scheduleSettingsSave(get);
  },
  removeWatch: (ticker) => {
    const wl = get().watchlist.filter((w) => w.ticker !== ticker);
    persistWatch(wl);
    set({ watchlist: wl });
    scheduleSettingsSave(get);
  },
  addNote: (ticker, text) => {
    const t = text.trim();
    if (!t) return;
    const entry: NoteEntry = { id: newId(), ts: Date.now(), text: t };
    const notes = { ...get().notes, [ticker]: [...(get().notes[ticker] || []), entry] };
    persistNotes(notes);
    set({ notes });
    scheduleSettingsSave(get);
  },
  removeNote: (ticker, id) => {
    const list = (get().notes[ticker] || []).filter((n) => n.id !== id);
    const notes = { ...get().notes };
    if (list.length) notes[ticker] = list;
    else delete notes[ticker];
    persistNotes(notes);
    set({ notes });
    scheduleSettingsSave(get);
  },
}));

function persistWatch(wl: WatchEntry[]) {
  try {
    localStorage.setItem("pf_watchlist", JSON.stringify(wl));
  } catch {
    /* ignore */
  }
}
function persistNotes(notes: NotesMap) {
  try {
    localStorage.setItem("pf_notes", JSON.stringify(notes));
  } catch {
    /* ignore */
  }
}
