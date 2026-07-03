// ============================================================================
// LIVE, GENERIC PORTFOLIO ENGINE
// Rebuilds the entire dashboard model from (1) parsed transactions and (2) live
// prices fetched by ISIN from /api/prices. NOTHING is hardcoded to a specific
// portfolio: instruments are classified from Yahoo metadata (type / assetClass /
// money-market heuristics) with a transaction-price fallback when a security has
// no market feed. Produces the exact shapes the UI already consumes so the view
// layer stays unchanged.
// ============================================================================

import { eur, sgn } from "./format";
import type { Txn } from "./transactions";
import type {
  AllocDim,
  AllocSeg,
  BenchDef,
  HoldingGroup,
  PerfStat,
  TableGroup,
  TableRow,
} from "./types";
import type { Kpi, HoldRow, HoldGroup, CompanyMetrics, Performance, PerfGroups, TrendPeriod, AllocContribution, AnalysisStock } from "./portfolio";

export const ACCENT = "#0000e6";
const GREY = "#d9d9d9";
// blue-family palette; slices are coloured by descending weight so the model
// stays generic for any set of sector / region / asset labels.
// allocation band colours — DESIGN-SYSTEM tokens ONLY (design_handoff colors_and_type.css).
// Priority: brand blue → brand support colours → the house grey → other tokens only if needed.
const PALETTE = [
  ACCENT, // brand blue          #0000e6
  "#c49cff", // support purple
  "#91a77f", // support green
  "#d4fcb3", // support lime
  "#fccebe", // support light red
  GREY, // house grey          #d9d9d9
  // beyond the brand set — other design-system tokens:
  "#ad0101", // error red
  "#256100", // success green
  "#7a3e00", // warning brown
  "#d0553a", // rec reduce
  "#2e2eff", // brand blue ink
];

// ---- price feed shape (mirrors api/_lib/prices.mjs) ----
export interface PriceInfo {
  isin: string;
  found: boolean;
  symbol?: string;
  name?: string;
  type?: string; // EQUITY | ETF | MUTUALFUND | INDEX
  sector?: string | null;
  country?: string | null;
  assetClass?: string | null; // Equity | Fixed Income | Money Market (funds)
  sectorWeights?: Record<string, number> | null; // equity-fund sector look-through { sector: weight 0..1 }
  regionHint?: string | null; // dominant country of a fund's top holdings (region fallback)
  moneyMarket?: boolean;
  divYield?: number;
  price?: number;
  prevClose?: number;
  history?: { date: string; close: number }[];
  // Inderes analyst data (populated for covered companies; publicly shown on inderes.fi)
  rec?: string | null; // raw enum: BUY | INCREASE | HOLD | REDUCE | SELL
  targetPrice?: number | null;
  recDate?: string | null;
  divEstimates?: Record<string, number> | null; // analyst DPS estimates { year: dps } for T, T+1, T+2 (EUR)
  epsEstimates?: Record<string, number> | null; // analyst EPS estimates { year: eps } for T, T+1, T+2 (EUR)
  peTrailing?: number | null; // Yahoo trailing P/E (stocks; fallback source)
}

export interface DividendBar {
  year: number;
  actual: number; // dividends received that calendar year (all holdings, incl. since-sold)
  estimated: number; // current year only: analyst-estimated annual dividend from CURRENT holdings
}
export type PriceMap = Record<string, PriceInfo>;

// per-instrument manual active/passive override, keyed by ISIN (user Settings)
export type StyleOverrides = Record<string, "active" | "passive">;

// Inderes recommendation enum → UI label + CSS class (matches .rec.buy/.accu/…)
const REC_DISPLAY: Record<string, [string, string]> = {
  BUY: ["Buy", "buy"],
  ACCUMULATE: ["Accumulate", "accu"],
  INCREASE: ["Accumulate", "accu"],
  HOLD: ["Hold", "hold"],
  REDUCE: ["Reduce", "redu"],
  DECREASE: ["Reduce", "redu"],
  SELL: ["Sell", "sell"],
};
function recOf(raw?: string | null): { recShort: string; recCls: string } {
  const d = raw ? REC_DISPLAY[String(raw).toUpperCase()] : null;
  return d ? { recShort: d[0], recCls: d[1] } : { recShort: "—", recCls: "na" };
}

// ---- benchmark universe (UI key → Yahoo symbol) ----
export const benchDefs: Record<string, BenchDef> = {
  OMXH25: { label: "OMX Helsinki 25", drift: 0, vol: 0, seed: 0 },
  OMXS30: { label: "OMX Stockholm 30", drift: 0, vol: 0, seed: 0 },
  SP500: { label: "S&P 500", drift: 0, vol: 0, seed: 0 },
  MSCI: { label: "MSCI World", drift: 0, vol: 0, seed: 0 },
  STOXX: { label: "STOXX Europe 600", drift: 0, vol: 0, seed: 0 },
};
export const BENCH_SYMBOL: Record<string, string> = {
  OMXH25: "^OMXH25",
  OMXS30: "^OMX",
  SP500: "^GSPC",
  MSCI: "URTH", // iShares MSCI World ETF (USD, FX-normalised by the resolver)
  STOXX: "^STOXX",
};

// ---- small helpers ----
function hashInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (Math.abs(h) % 90000) + 100;
}
// A short, readable ticker: Yahoo symbol without its exchange suffix
// (INDERES.HE→INDERES, R2US.L→R2US); mutual-fund codes (0P…) and missing
// symbols fall back to a name abbreviation, then the ISIN.
function tickerFrom(symbol: string | undefined, name: string, isin: string): string {
  if (symbol) {
    const base = symbol.split(".")[0];
    if (/^[A-Za-z]/.test(base) && !/^0P/i.test(base)) return base.toUpperCase();
  }
  const words = (name || "").replace(/[^A-Za-z0-9 ]/g, "").trim().split(/\s+/).filter(Boolean);
  if (words.length) return words[0].slice(0, 6).toUpperCase();
  return isin;
}

const isFund = (t?: string) => t === "ETF" || t === "MUTUALFUND";
const FUND_NAME_RE = /rahasto|\bfund\b|\betf\b|index|indeksi|ucits|msci|s&p|stoxx|ishares|amundi|spdr|invesco|xtrackers|lyxor|vanguard/i;
const MM_NAME_RE = /liquidity|money.?market|rahamarkkina|likvid|kassa|ultra.?short|overnight|euro short|short.?term (bond|fixed|money)|t-?bill|treasury bill/i;
const FI_NAME_RE = /bond|fixed income|korko|oblig|treasury|govt|government|aggregate/i;

// sorted weekly history for as-of lookups
function sortedHist(info?: PriceInfo): { d: number; v: number }[] {
  if (!info?.history?.length) return [];
  return info.history.map((h) => ({ d: +new Date(h.date), v: h.close })).sort((a, b) => a.d - b.d);
}
function asOf(hist: { d: number; v: number }[], t: number, fallback: number): number {
  if (!hist.length) return fallback;
  let v = fallback;
  let got = false;
  for (const p of hist) {
    if (p.d <= t) { v = p.v; got = true; } else break;
  }
  // before the series starts, use the first known point (better than 0)
  if (!got) return hist[0].v;
  return v;
}

// The five portfolio buckets. Non-cash sleeves drive the performance engine;
// "other" catches anything that fits no other bucket (bonds held directly,
// commodities, crypto, unknown types…).
const PERF_SLEEVES = ["stocks", "eqFunds", "fiFunds", "other"] as const;
type PerfSleeve = (typeof PERF_SLEEVES)[number];
type Sleeve = PerfSleeve | "cash";

// ---- generic classification ----
interface Cls {
  sleeve: Sleeve;
  group: HoldingGroup;
  kind: string; // Stock | ETF | Index fund | Active fund | Bond fund | Other | Cash eq.
  typeAP: "active" | "passive";
  sectorLabel: string; // for allocation (funds → asset-class label)
  assetLabel: "Equities" | "Fixed income" | "Other" | "Cash & equivalent";
}
// a non-ETF fund whose name references an index → passive index fund; else active
const INDEX_NAME_RE = /index|indeksi|\bomx|\bmsci\b|s&p|stoxx|ftse|\bdax\b|mdax|russell|nasdaq|nikkei|\bcac\b|\bdow\b|tracker/i;
const FUND_TYPES = ["ETF", "MUTUALFUND"];
// clearly non-equity exchange-traded products by NAME: commodity ETCs (physical
// gold/silver…), leveraged certificates & warrants (incl. Nordnet's "T SHRT"/"T LONG"),
// crypto trackers. Tested BEFORE the fund branch (so a gold ETC that Yahoo types as
// "ETF" still lands in Other) but AFTER the EQUITY branch (a resolved stock named
// "Gold Fields" stays a stock). Not foolproof — heuristics never are.
const OTHER_NAME_RE = /\bphysical\b|\bgold\b|\bsilver\b|platinum|palladium|commodit|\betc\b|\betn\b|\betp\b|bitcoin|ethereum|crypto|\bbull\b|\bbear\b|turbo|warrant|mini.?future|certifi|\bshrt\b|\bt ?long\b|leverag|\b\dx\b/i;

function classify(name: string, info?: PriceInfo): Cls {
  const t = info?.type;
  const mm = info?.moneyMarket || MM_NAME_RE.test(name);
  const looksFund = isFund(t) || (!t && FUND_NAME_RE.test(name));

  // individual stocks are always active (unresolved non-fund-looking names default
  // here too — the largest bucket is the least-bad guess for an unknown instrument)
  if (t === "EQUITY" || (!t && !looksFund && !mm && !OTHER_NAME_RE.test(name))) {
    return { sleeve: "stocks", group: "Stocks", kind: "Stock", typeAP: "active", sectorLabel: normSector(info?.sector), assetLabel: "Equities" };
  }
  // cash & equivalents are their own style bucket (neither active nor passive);
  // typeAP is unused for cash since it's excluded from the active/passive split.
  // The test is description/name-based, so it applies even to unresolved instruments.
  if (mm) {
    return { sleeve: "cash", group: "Cash", kind: "Cash eq.", typeAP: "passive", sectorLabel: "Cash equivalent", assetLabel: "Cash & equivalent" };
  }
  // Other: commodity/certificate/crypto products by name, or a known type that is
  // neither a stock nor a fund (bond, commodity, crypto, …)
  if (OTHER_NAME_RE.test(name) || (t && !FUND_TYPES.includes(t))) {
    return { sleeve: "other", group: "Other", kind: "Other", typeAP: "active", sectorLabel: "Other", assetLabel: "Other" };
  }
  // fixed-income funds that aren't cash equivalents → Fixed income (active)
  const ac = info?.assetClass || (FI_NAME_RE.test(name) ? "Fixed Income" : "Equity");
  if (ac === "Fixed Income") {
    return { sleeve: "fiFunds", group: "FixedIncomeFunds", kind: "Bond fund", typeAP: "active", sectorLabel: "Fixed income fund", assetLabel: "Fixed income" };
  }
  // equity fund → ETF / Index (passive) or actively-managed (active)
  if (t === "ETF") {
    return { sleeve: "eqFunds", group: "EquityFunds", kind: "ETF", typeAP: "passive", sectorLabel: "Equity fund", assetLabel: "Equities" };
  }
  const isIndex = INDEX_NAME_RE.test(name);
  return {
    sleeve: "eqFunds", group: "EquityFunds",
    kind: isIndex ? "Index fund" : "Active fund",
    typeAP: isIndex ? "passive" : "active",
    sectorLabel: "Equity fund", assetLabel: "Equities",
  };
}

const SECTOR_MAP: Record<string, string> = {
  "Financial Services": "Financials",
  "Consumer Cyclical": "Consumer disc.",
  "Consumer Defensive": "Consumer staples",
  "Basic Materials": "Materials",
  "Communication Services": "Communications",
};
function normSector(s?: string | null): string {
  if (!s) return "Other";
  return SECTOR_MAP[s] || s;
}
function normRegion(country?: string | null): string {
  if (!country) return "Other";
  if (/united states|usa/i.test(country)) return "USA";
  return country;
}

// Fund region by MANDATE (name) — stable across price refreshes; falls back to
// the dominant-holdings country hint, then "Global". Order matters: specific → general
// (e.g. "Far East" must beat "Japan" for an ex-Japan fund; index countries beat "Europe").
const REGION_PATTERNS: [RegExp, string][] = [
  [/nordic|norden|pohjois/i, "Nordics"],
  [/helsink|omxh|\bomx\b|finland|suomi/i, "Finland"],
  [/sweden|sverige|omxs/i, "Sweden"],
  [/norway|norge/i, "Norway"],
  [/denmark|danmark/i, "Denmark"],
  [/emerging|kehittyv|\bem\b/i, "Emerging markets"],
  [/mdax|\bdax\b|german|deutsch/i, "Germany"],
  [/far east|asia|pacific|apac/i, "Asia"],
  [/japan|nikkei|topix/i, "Japan"],
  [/taiwan/i, "Taiwan"],
  [/china|hong ?kong|\bhk\b/i, "China"],
  [/\bindia\b/i, "India"],
  [/ftse|united kingdom|britain|\buk\b/i, "United Kingdom"],
  [/russell|s&p|sp ?500|\bus\b|u\.s\.|america|nasdaq|\bdow\b/i, "USA"],
  [/europe|euroopp|stoxx|euro ?zone|\bemu\b/i, "Europe"],
  [/world|global|acwi|all.?countr/i, "Global"],
];
function fundRegion(name: string, hint?: string | null): string {
  for (const [re, label] of REGION_PATTERNS) if (re.test(name)) return label;
  return hint || "Global";
}

// ---- reconstructed position (current) ----
interface Sec {
  isin: string;
  name: string;
  ticker: string;
  qty: number;
  cost: number; // avg-cost basis remaining
  last: number;
  value: number;
  dayPct: number;
  totalPct: number;
  divYield: number; // trailing 12-month dividend yield (Yahoo)
  fwdYield: number; // forward yield: next-year analyst DPS / price, else trailing
  pe: number | null; // stocks: price / Inderes current-year EPS est., else Yahoo trailing; null if loss-making/unknown
  peSrc: string; // "Inderes est." | "Yahoo trailing" | "loss-making" | "—"
  seed: number;
  cls: Cls;
  region: string;
  sectorWeights: Record<string, number> | null; // equity-fund sector look-through (else null)
  recShort: string;
  recCls: string;
  targetPrice: number | null;
  spark: number[]; // last ~13 weekly closes (EUR) for the 3-month sparkline
}

const shareSign = (c: string): number => (c === "buy" || c === "transfer_in" ? 1 : c === "sell" || c === "transfer_out" ? -1 : 0);

// last known transaction price per isin (fallback when no market feed).
// ONLY trade rows (buy/sell/transfer) carry a real per-share price; dividend/tax
// rows put the dividend-per-share in `price` (e.g. €0.22), which must never be
// mistaken for the share price — doing so under-values the holding ~60× and makes
// a later sale look like a huge phantom gain. Restrict to shareSign ≠ 0 rows.
function lastTxnPrice(txns: Txn[]): Record<string, number> {
  const m: Record<string, number> = {};
  txns
    .filter((t) => t.price > 0 && shareSign(t.category) !== 0 && (t.isin || t.ticker))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .forEach((t) => (m[t.isin || t.ticker] = t.price));
  return m;
}

// ============================================================================
// The whole model
// ============================================================================
export interface Portfolio {
  kpis: Kpi[];
  allocMap: Record<AllocDim, AllocSeg[]>;
  allocModeLbl: Record<AllocDim, string>;
  allocDetail: Record<AllocDim, Record<string, AllocContribution[]>>; // instruments behind each bucket
  allocSeries: Record<AllocDim, Record<string, number[]>>; // real per-label weight-% history
  allocDates: string[]; // time axis for allocSeries (ISO dates, oldest → today)
  tableGroups: TableGroup[];
  holdingsGroups: HoldGroup[];
  assetCurrent: Record<string, number>;
  activePctNum: number;
  passivePctNum: number;
  cashPctNum: number;
  totalValue: number;
  benchDefs: Record<string, BenchDef>;
  isHeld: (ticker: string) => boolean;
  companyMetrics: (ticker: string) => CompanyMetrics | null;
  getPerformance: (benchKey: string, period: TrendPeriod, groups: PerfGroups) => Performance;
  perfAvailable: PerfGroups; // which buckets have (ever had) assets — empty ones are hidden in the UI
  analysisStocks: AnalysisStock[]; // individual stocks with P/E, for the Analysis tab
  dividends: DividendBar[];
  hasPrices: boolean;
}

const recStub = { recShort: "—", recCls: "na" };

/** Mask shown instead of market-value euro amounts in privacy ("hide values") mode. */
export const VALUE_MASK = "•••••";

export function buildPortfolio(txns: Txn[], prices: PriceMap, styleOverrides: StyleOverrides = {}, hideValues = false): Portfolio {
  const keyOf = (t: Txn) => t.isin || t.ticker || t.name;
  const fallbackPx = lastTxnPrice(txns);
  // privacy mode: market values render as dots; prices, costs, dividends and
  // percentages stay visible (they don't reveal the portfolio's size directly)
  const eurV = (n: number) => (hideValues ? VALUE_MASK : eur(n));

  // ---- walk chronologically: positions (avg cost) + cash balance ----
  const asc = txns
    .map((t, i) => ({ t, i }))
    .sort((a, b) => (a.t.date < b.t.date ? -1 : a.t.date > b.t.date ? 1 : a.i - b.i))
    .map((x) => x.t);

  const pos: Record<string, { name: string; ticker: string; isin: string; qty: number; cost: number }> = {};
  let cashBalance = 0;
  asc.forEach((t) => {
    cashBalance += t.amount || 0;
    const sign = shareSign(t.category);
    if (sign === 0) return;
    const k = keyOf(t);
    if (!k) return;
    if (!pos[k]) pos[k] = { name: t.name || t.ticker || k, ticker: t.ticker || t.isin || k, isin: t.isin || k, qty: 0, cost: 0 };
    const p = pos[k];
    if (t.name && (!p.name || p.name === p.isin)) p.name = t.name;
    if (sign === 1) {
      p.cost += t.acqValue > 0 ? t.acqValue : t.qty * t.price + t.fee;
      p.qty += t.qty;
    } else {
      if (p.qty > 1e-9) p.cost = Math.max(0, p.cost - (p.cost / p.qty) * t.qty);
      p.qty -= t.qty;
    }
  });

  const priceOf = (isin: string): PriceInfo | undefined => prices[isin];
  const hasPrices = Object.keys(prices).length > 0;

  // lifetime dividends received per instrument (for TOTAL return incl. dividends)
  const divByIsin: Record<string, number> = {};
  for (const t of txns) {
    if (t.category !== "dividend") continue;
    const k = t.isin || t.ticker || t.name;
    if (k) divByIsin[k] = (divByIsin[k] || 0) + (t.amount || 0);
  }

  // trailing 12-month dividend-per-share (EUR) from the user's OWN dividend
  // transactions — a last-resort yield source for holdings that neither Inderes
  // nor Yahoo cover (e.g. some First North names). amount ÷ qty = per-share EUR.
  // A single payout can span several lot-rows on the same date with identical
  // DPS, so key by (instrument, date) to record each event's DPS once, then sum
  // distinct events across the trailing year.
  const trailCutoff = Date.now() - 365 * 864e5;
  const dpsByEvent: Record<string, number> = {};
  for (const t of txns) {
    if (t.category !== "dividend" || !t.date || +new Date(t.date) < trailCutoff) continue;
    const k = t.isin || t.ticker || t.name;
    const dps = t.qty > 0 ? (t.amount || 0) / t.qty : 0;
    if (k && dps > 0) dpsByEvent[k + "|" + t.date] = dps;
  }
  const trailingDpsByIsin: Record<string, number> = {};
  for (const key in dpsByEvent) {
    const k = key.slice(0, key.indexOf("|"));
    trailingDpsByIsin[k] = (trailingDpsByIsin[k] || 0) + dpsByEvent[key];
  }

  // ---- current securities ----
  const NEXT_YEAR = new Date().getFullYear() + 1; // forward-yield reference year
  const secs: Sec[] = Object.values(pos)
    .filter((p) => p.qty > 1e-6)
    .map((p) => {
      const info = priceOf(p.isin);
      const cls = classify(p.name, info);
      // manual active/passive override (stocks & funds only; cash isn't active/passive)
      const ov = styleOverrides[p.isin];
      if (ov && cls.sleeve !== "cash") cls.typeAP = ov;
      const last = info?.found && info.price ? info.price : fallbackPx[p.isin] || (p.qty ? p.cost / p.qty : 0);
      const prev = info?.found && info.prevClose ? info.prevClose : last;
      const value = p.qty * last;
      const cost = p.cost;
      const divRecv = divByIsin[p.isin] || 0; // dividends received while holding
      const rd = recOf(info?.rec);
      // forward dividend yield, best source first: (1) next-year Inderes DPS
      // estimate ÷ price, (2) Yahoo trailing 12-month yield, (3) trailing yield
      // derived from the user's own dividend transactions.
      const nextDps = info?.divEstimates?.[NEXT_YEAR];
      const ownTrailYield = last > 0 && trailingDpsByIsin[p.isin] ? (trailingDpsByIsin[p.isin] / last) * 100 : 0;
      const fwdYield = nextDps != null && last > 0 ? (nextDps / last) * 100 : info?.divYield || ownTrailYield;
      // P/E for individual stocks: price ÷ Inderes current-year EPS estimate;
      // loss-making (EPS ≤ 0) has no meaningful P/E; fallback = Yahoo trailing P/E.
      const curEps = info?.epsEstimates?.[NEXT_YEAR - 1];
      let pe: number | null = null, peSrc = "—";
      if (cls.group === "Stocks") {
        if (curEps != null && last > 0) {
          if (curEps > 0) { pe = +(last / curEps).toFixed(1); peSrc = "Inderes est."; }
          else peSrc = "loss-making";
        } else if (info?.peTrailing) { pe = +info.peTrailing.toFixed(1); peSrc = "Yahoo trailing"; }
      }
      return {
        isin: p.isin,
        name: p.name,
        ticker: tickerFrom(info?.symbol, p.name, p.ticker || p.isin),
        qty: p.qty,
        cost,
        last,
        value,
        dayPct: prev ? (last / prev - 1) * 100 : 0,
        totalPct: cost > 0 ? ((value + divRecv - cost) / cost) * 100 : 0,
        divYield: info?.divYield || 0,
        fwdYield,
        pe,
        peSrc,
        seed: hashInt(p.isin),
        cls,
        // stocks → company country; cash → own bucket; funds & other → mandate region (name) / holdings hint
        region: cls.sleeve === "stocks" ? normRegion(info?.country) : cls.sleeve === "cash" ? "Cash" : fundRegion(p.name, info?.regionHint),
        sectorWeights: cls.group === "EquityFunds" ? info?.sectorWeights ?? null : null,
        recShort: rd.recShort,
        recCls: rd.recCls,
        targetPrice: info?.targetPrice ?? null,
        spark: info?.found && info.history ? info.history.slice(-13).map((h) => h.close) : [],
      };
    })
    .sort((a, b) => b.value - a.value);

  const secValue = secs.reduce((s, h) => s + h.value, 0);
  // cash balance can drift slightly negative from rounding; floor at 0
  const CASH_V = Math.max(0, cashBalance);
  const TOTAL = secValue + CASH_V;
  const safeTotal = TOTAL || 1;

  // ---- group values ----
  const gVal = (k: HoldingGroup): number => {
    const base = secs.filter((h) => h.cls.group === k).reduce((s, h) => s + h.value, 0);
    return k === "Cash" ? base + CASH_V : base;
  };

  const investable = secs.filter((h) => h.cls.group !== "Cash");
  const holdingsValue = investable.reduce((s, h) => s + h.value, 0);
  const cashEquivValue = secs.filter((h) => h.cls.group === "Cash").reduce((s, h) => s + h.value, 0);
  const cashTotal = CASH_V + cashEquivValue;
  const investCost = investable.reduce((s, h) => s + h.cost, 0);
  const investDiv = investable.reduce((s, h) => s + (divByIsin[h.isin] || 0), 0); // dividends received on held names
  const totRetPct = investCost > 0 ? ((holdingsValue + investDiv - investCost) / investCost) * 100 : 0;
  const dayAbs = secs.reduce((s, h) => s + (h.value * h.dayPct) / 100, 0);
  const dayPct = TOTAL - dayAbs !== 0 ? (dayAbs / (TOTAL - dayAbs)) * 100 : 0;
  const divIncome = investable.reduce((s, h) => s + (h.value * h.fwdYield) / 100, 0); // forward (est.) income
  const divYield = (divIncome / safeTotal) * 100;
  // three-way style split of the whole portfolio: invested holdings by their
  // typeAP, and cash & equivalents (raw cash + money-market funds) as their own
  // bucket — these three sum to 100%.
  const activeValue = investable.filter((h) => h.cls.typeAP === "active").reduce((s, h) => s + h.value, 0);
  const passiveValue = investable.filter((h) => h.cls.typeAP === "passive").reduce((s, h) => s + h.value, 0);
  const activePct = (activeValue / safeTotal) * 100;
  const passivePct = (passiveValue / safeTotal) * 100;
  const cashPct = (cashTotal / safeTotal) * 100;

  const kpis: Kpi[] = [
    { label: "Total value", value: eurV(TOTAL), cls: "" },
    { label: "Today", value: sgn(dayPct, 2), cls: dayPct >= 0 ? "up" : "down" },
    { label: "Total return", value: sgn(totRetPct), cls: totRetPct >= 0 ? "up" : "down" },
    { label: "Holdings", value: eurV(holdingsValue), cls: "" },
    { label: "Cash", value: eurV(cashTotal), cls: "" },
    { label: "Passive", value: passivePct.toFixed(1) + "%", cls: "" },
    { label: "Div. yield", value: divYield.toFixed(2) + "%", cls: "" },
  ];

  // ---- allocations (coloured by descending weight; Cash always grey) ----
  function buildSeg(entries: { label: string; pct: number }[]): AllocSeg[] {
    const sorted = entries
      .filter((e) => e.pct > 0.01)
      .sort((a, b) => (Number(isCashLabel(a.label)) - Number(isCashLabel(b.label))) || b.pct - a.pct);
    let ci = 0;
    return sorted.map((e) => ({
      label: e.label,
      pctNum: e.pct,
      color: isCashLabel(e.label) ? GREY : PALETTE[ci++ % PALETTE.length],
      pctStr: e.pct.toFixed(1) + "%",
    }));
  }
  const isCashLabel = (l: string) => /^cash/i.test(l);

  // Weighted aggregation: a holding may feed MULTIPLE buckets (equity funds spread
  // across sectors via look-through). Returns bucket totals AND the per-instrument
  // contributions behind each bucket (for the drill-down panel). Cash (real +
  // money-market) is a single bucket, labelled per view.
  const contribRow = (h: Sec, value: number, note?: string): AllocContribution => ({
    ticker: h.ticker, name: h.name, value, valueStr: eurV(value), pctStr: ((value / safeTotal) * 100).toFixed(1) + "%", note,
  });
  function aggregate(contribs: (h: Sec) => { label: string; value: number; note?: string }[], cashLabel = "Cash") {
    const m: Record<string, number> = {};
    const detail: Record<string, AllocContribution[]> = {};
    investable.forEach((h) => {
      for (const c of contribs(h)) if (c.value > 0) {
        m[c.label] = (m[c.label] || 0) + c.value;
        (detail[c.label] ||= []).push(contribRow(h, c.value, c.note));
      }
    });
    if (cashTotal > 0) {
      m[cashLabel] = (m[cashLabel] || 0) + cashTotal;
      const cd = (detail[cashLabel] ||= []);
      if (CASH_V > 0) cd.push({ ticker: "CASH", name: "Cash balance (EUR)", value: CASH_V, valueStr: eurV(CASH_V), pctStr: ((CASH_V / safeTotal) * 100).toFixed(1) + "%" });
      secs.filter((s) => s.cls.group === "Cash").forEach((h) => cd.push(contribRow(h, h.value)));
    }
    for (const k in detail) detail[k].sort((a, b) => b.value - a.value);
    return { segs: Object.keys(m).map((label) => ({ label, pct: (m[label] / safeTotal) * 100 })), detail };
  }

  // SECTOR — stocks by sector; equity funds looked-through via sector weightings;
  // fixed-income funds and cash form their own buckets.
  const sectorAgg = aggregate((h) => {
    if (h.cls.group === "FixedIncomeFunds") return [{ label: "Fixed income", value: h.value }];
    if (h.cls.group === "EquityFunds") {
      const sw = h.sectorWeights;
      const tot = sw ? Object.values(sw).reduce((s, w) => s + w, 0) : 0;
      if (sw && tot > 0) return Object.entries(sw).map(([label, w]) => ({ label, value: h.value * (w / tot), note: (w / tot * 100).toFixed(0) + "% of fund" }));
      return [{ label: "Equity fund (unclassified)", value: h.value }];
    }
    return [{ label: h.cls.sectorLabel, value: h.value }]; // stocks
  });
  // REGION — stocks by company country; funds by mandate region; cash its own bucket.
  const regionAgg = aggregate((h) => [{ label: h.region, value: h.value }]);
  // ASSET — Stocks / Equity funds / Fixed income / Cash & equivalents.
  const assetViewLabel = (h: Sec): string =>
    h.cls.group === "Stocks" ? "Stocks"
      : h.cls.group === "EquityFunds" ? "Equity funds"
        : h.cls.group === "FixedIncomeFunds" ? "Fixed income"
          : h.cls.group === "Other" ? "Other"
            : "Cash & equivalents";
  const assetAgg = aggregate((h) => [{ label: assetViewLabel(h), value: h.value }], "Cash & equivalents");
  // STYLE — active / passive / cash & equivalents (cash is its own bucket).
  const styleAgg = aggregate((h) => [{ label: h.cls.typeAP === "active" ? "Active" : "Passive", value: h.value }], "Cash & equivalents");

  const sectorSeg = buildSeg(sectorAgg.segs);
  const regionSeg = buildSeg(regionAgg.segs);
  const assetSeg = buildSeg(assetAgg.segs);
  const styleSeg = buildSeg([
    { label: "Active", pct: activePct },
    { label: "Passive", pct: passivePct },
    { label: "Cash & equivalents", pct: cashPct },
  ]);
  styleSeg.forEach((s) => (s.color = s.label === "Active" ? ACCENT : s.label === "Passive" ? "#c49cff" : GREY));

  const allocMap: Record<AllocDim, AllocSeg[]> = { sector: sectorSeg, region: regionSeg, asset: assetSeg, style: styleSeg };
  const allocModeLbl: Record<AllocDim, string> = { sector: "sector", region: "region", asset: "asset-class", style: "style" };
  const allocDetail: Record<AllocDim, Record<string, AllocContribution[]>> = {
    sector: sectorAgg.detail, region: regionAgg.detail, asset: assetAgg.detail, style: styleAgg.detail,
  };

  // assetCurrent stays on the BROAD classes (Equities / Fixed income / Other /
  // Cash & equivalent) the Calculations projection + Strategy targets rely on.
  const assetCurrent: Record<string, number> = {};
  aggregate((h) => [{ label: h.cls.assetLabel, value: h.value }], "Cash & equivalent").segs.forEach((e) => (assetCurrent[e.label] = e.pct));

  // ---- grouped tables ----
  const grpMeta: { key: HoldingGroup; label: string }[] = [
    { key: "Stocks", label: "Stocks" },
    { key: "EquityFunds", label: "Equity funds" },
    { key: "FixedIncomeFunds", label: "Fixed income" },
    { key: "Other", label: "Other assets" },
    { key: "Cash", label: "Cash & cash equivalents" },
  ];
  const tagOf: Record<string, [string, string]> = {
    Stock: ["Stock", "act"],
    ETF: ["ETF", "pas"],
    "Index fund": ["Index", "pas"],
    "Active fund": ["Active", "act"],
    "Bond fund": ["Bond", "act"],
    Other: ["Other", "act"],
    "Cash eq.": ["Cash eq", "csh"],
  };

  const rowOf = (h: Sec): TableRow => {
    const tg = tagOf[h.cls.kind] || ["", ""];
    return {
      ticker: h.ticker,
      name: h.name,
      sector: h.cls.sectorLabel,
      lastStr: h.last.toFixed(2),
      weightStr: ((h.value / safeTotal) * 100).toFixed(1) + "%",
      valueStr: eurV(h.value),
      totalStr: sgn(h.totalPct),
      totCls: h.totalPct >= 0 ? "up" : "down",
      recShort: h.recShort,
      recCls: h.recCls,
      typeLbl: tg[0],
      typeCls: "tp " + tg[1],
      sparkData: h.spark.length >= 2 ? h.spark : null,
      sparkUp: h.spark.length >= 2 ? h.spark[h.spark.length - 1] >= h.spark[0] : h.totalPct >= 0,
    };
  };
  const cashRow: TableRow = {
    ticker: "CASH", name: "Cash balance (EUR)", sector: "—", lastStr: "—",
    weightStr: ((CASH_V / safeTotal) * 100).toFixed(1) + "%", valueStr: eurV(CASH_V),
    totalStr: "—", totCls: "", ...recStub, typeLbl: "Cash", typeCls: "tp csh", sparkData: null, sparkUp: true,
  };
  const tableGroups: TableGroup[] = grpMeta
    .map((g) => {
      const items = secs.filter((h) => h.cls.group === g.key).map(rowOf);
      const rows = g.key === "Cash" ? [...items, cashRow] : items;
      const val = gVal(g.key);
      return { key: g.key, label: g.label, valueStr: eurV(val), pctStr: ((val / safeTotal) * 100).toFixed(1) + "%", rows };
    })
    .filter((g) => g.rows.length);

  // ---- full holdings rows ----
  const rowFull = (h: Sec): HoldRow => {
    const tg = tagOf[h.cls.kind] || ["", ""];
    return {
      ticker: h.ticker,
      name: h.name,
      typeLbl: tg[0],
      typeCls: "tp " + tg[1],
      sector: h.cls.sectorLabel,
      sharesStr: h.qty.toLocaleString("en-US", { maximumFractionDigits: 2 }),
      avgStr: "€" + (h.qty ? h.cost / h.qty : 0).toFixed(2),
      lastStr: h.last.toFixed(2),
      valueStr: eurV(h.value),
      dayStr: sgn(h.dayPct),
      dayCls: h.dayPct >= 0 ? "up" : "down",
      totalStr: sgn(h.totalPct),
      totCls: h.totalPct >= 0 ? "up" : "down",
      yieldStr: h.fwdYield.toFixed(1) + "%",
      weightStr: ((h.value / safeTotal) * 100).toFixed(1) + "%",
      recShort: h.recShort,
      recCls: h.recCls,
    };
  };
  const cashRowFull: HoldRow = {
    ticker: "CASH", name: "Cash balance (EUR)", typeLbl: "Cash", typeCls: "tp csh", sector: "—",
    sharesStr: "—", avgStr: "—", lastStr: "—", valueStr: eurV(CASH_V), dayStr: "—", dayCls: "",
    totalStr: "—", totCls: "", yieldStr: "—", weightStr: ((CASH_V / safeTotal) * 100).toFixed(1) + "%", ...recStub,
  };
  const holdingsGroups: HoldGroup[] = grpMeta
    .map((g) => {
      const items = secs.filter((h) => h.cls.group === g.key).map(rowFull);
      const rows = g.key === "Cash" ? [...items, cashRowFull] : items;
      const val = gVal(g.key);
      return { key: g.key, label: g.label, valueStr: eurV(val), pctStr: ((val / safeTotal) * 100).toFixed(1) + "%", rows };
    })
    .filter((g) => g.rows.length);

  // ---- Analysis tab: individual stocks with P/E (weights vs the stock sleeve) ----
  const anStocks = secs.filter((h) => h.cls.group === "Stocks");
  const anTotal = anStocks.reduce((s, h) => s + h.value, 0) || 1;
  const analysisStocks: AnalysisStock[] = anStocks.map((h) => ({
    isin: h.isin,
    ticker: h.ticker,
    name: h.name,
    value: h.value,
    valueStr: eurV(h.value),
    weightPct: (h.value / anTotal) * 100,
    weightStr: ((h.value / anTotal) * 100).toFixed(1) + "%",
    pe: h.pe,
    peStr: h.pe != null ? h.pe.toFixed(1) : h.peSrc === "loss-making" ? "neg." : "—",
    peSrc: h.peSrc,
  }));

  // ---- per-ticker lookup ----
  const byTicker: Record<string, Sec> = {};
  secs.forEach((h) => (byTicker[h.ticker] = h));
  const isHeld = (ticker: string) => !!byTicker[ticker];
  const companyMetrics = (ticker: string): CompanyMetrics | null => {
    const h = byTicker[ticker];
    if (!h) return null;
    // which allocation buckets it lands in, + the raw variables behind them
    const info = priceOf(h.isin);
    const g = h.cls.group;
    const bucketAsset = g === "Stocks" ? "Stocks" : g === "EquityFunds" ? "Equity funds" : g === "FixedIncomeFunds" ? "Fixed income" : g === "Other" ? "Other" : "Cash & equivalents";
    const bucketStyle = g === "Cash" ? "Cash & equivalents" : h.cls.typeAP === "active" ? "Active" : "Passive";
    const bucketSector = g === "Stocks" ? h.cls.sectorLabel : g === "EquityFunds" ? (h.sectorWeights ? "Look-through" : "Equity fund") : g === "FixedIncomeFunds" ? "Fixed income" : g === "Other" ? "Other" : "Cash";
    const swTot = h.sectorWeights ? Object.values(h.sectorWeights).reduce((s, w) => s + w, 0) : 0;
    const fundSectors = g === "EquityFunds" && h.sectorWeights && swTot > 0
      ? Object.entries(h.sectorWeights).map(([label, w]) => ({ label, pctStr: ((w / swTot) * 100).toFixed(0) + "%", n: w })).sort((a, b) => b.n - a.n).map(({ label, pctStr }) => ({ label, pctStr }))
      : null;
    const regionBasis = h.cls.sleeve === "stocks" ? "Company country (Yahoo)"
      : h.cls.sleeve === "cash" ? "—"
        : REGION_PATTERNS.some(([re]) => re.test(h.name)) ? "Fund mandate (name)" : info?.regionHint ? "Top holdings" : "Default (Global)";
    const clsVars = [
      { k: "Yahoo lookup", v: !info ? "No data yet" : info.found ? "Resolved" : "Not found (classified by name)" },
      { k: "Yahoo type", v: info?.type || "—" },
      { k: "Kind", v: h.cls.kind },
      { k: "Asset class", v: info?.assetClass || (h.cls.sleeve === "stocks" ? "Equity (stock)" : "—") },
      { k: "Money-market", v: h.cls.sleeve === "cash" ? "yes" : "no" },
      ...(h.cls.sleeve === "stocks" ? [{ k: "Sector (Yahoo)", v: info?.sector || "—" }, { k: "Country (Yahoo)", v: info?.country || "—" }] : []),
      { k: "Region basis", v: regionBasis },
    ];
    // effective style is h.cls.typeAP (post-override); auto = classification without override
    const autoCls = classify(h.name, info);
    const styleAuto = h.cls.sleeve === "cash" ? "Cash & equivalents" : autoCls.typeAP === "active" ? "Active" : "Passive";
    return {
      name: h.name,
      sector: h.cls.sectorLabel,
      region: h.region,
      lastStr: h.last.toFixed(2),
      valueStr: eurV(h.value),
      dayStr: sgn(h.dayPct),
      dayCls: h.dayPct >= 0 ? "up" : "down",
      totalStr: sgn(h.totalPct),
      totCls: h.totalPct >= 0 ? "up" : "down",
      weightStr: ((h.value / safeTotal) * 100).toFixed(1) + "%",
      sharesStr: h.qty.toLocaleString("en-US", { maximumFractionDigits: 2 }),
      avgStr: "€" + (h.qty ? h.cost / h.qty : 0).toFixed(2),
      yieldStr: h.fwdYield.toFixed(1) + "%",
      recShort: h.recShort,
      recCls: h.recCls,
      targetStr: h.targetPrice ? "€" + h.targetPrice.toFixed(2) : "—",
      bucketSector, bucketRegion: h.region, bucketAsset, bucketStyle, fundSectors, clsVars,
      isin: h.isin, styleAuto, styleOverridden: !!styleOverrides[h.isin],
    };
  };

  // ==========================================================================
  // TWR reconstruction over a weekly grid (true historical account incl. sold)
  // ==========================================================================
  const perf = buildTWR(asc, prices, fallbackPx, keyOf);
  // which buckets have ever held anything — the chart toggles hide the rest
  const perfAvailable: PerfGroups = {
    stocks: perf.values.stocks.some((v) => v > 0.5),
    eqFunds: perf.values.eqFunds.some((v) => v > 0.5),
    fiFunds: perf.values.fiFunds.some((v) => v > 0.5),
    other: perf.values.other.some((v) => v > 0.5),
    cash: perf.cashValue.some((v) => v > 0.5),
  };
  const { dates: allocDates, series: allocSeries } = buildAllocSeries(asc, prices, fallbackPx, keyOf, styleOverrides);

  function getPerformance(benchKey: string, period: TrendPeriod, groups: PerfGroups): Performance {
    return computePerformance(perf, benchKey, period, groups);
  }

  // ---- dividends: actual received per calendar year + current-year estimate ----
  const divByYear: Record<number, number> = {};
  for (const t of txns) {
    if (t.category !== "dividend" || !t.date) continue;
    const y = parseInt(t.date.slice(0, 4), 10);
    if (y) divByYear[y] = (divByYear[y] || 0) + (t.amount || 0);
  }
  const curYear = new Date().getFullYear();
  // estimated dividend income per year from CURRENT holdings, for the current year
  // and the next two. Prefer the Inderes analyst DPS estimate (DPS × shares); when a
  // holding has no estimate for a given year, fall back to its trailing dividend rate
  // — Yahoo's, else one derived from the user's own dividend transactions — the same
  // source chain the Holdings "Yield" column uses.
  const futureYears = [curYear, curYear + 1, curYear + 2];
  const estByYear: Record<number, number> = {};
  for (const h of secs) {
    const de = priceOf(h.isin)?.divEstimates;
    const trailYield = h.divYield > 0 ? h.divYield : h.last > 0 && trailingDpsByIsin[h.isin] ? (trailingDpsByIsin[h.isin] / h.last) * 100 : 0;
    const trailing = (h.value * trailYield) / 100;
    for (const y of futureYears) {
      const est = de && de[y] != null ? h.qty * de[y] : trailing;
      if (est) estByYear[y] = (estByYear[y] || 0) + est;
    }
  }
  const divYears = new Set<number>(Object.keys(divByYear).map(Number));
  futureYears.forEach((y) => divYears.add(y));
  const dividends: DividendBar[] = [...divYears]
    .sort((a, b) => a - b)
    .map((year) => {
      const actual = divByYear[year] || 0;
      const estFull = estByYear[year] || 0;
      // current year: estimated REMAINDER on top of what's received; future years: full estimate
      const estimated = year === curYear ? Math.max(0, estFull - actual) : year > curYear ? estFull : 0;
      return { year, actual, estimated };
    });

  return {
    kpis, allocMap, allocModeLbl, allocDetail, tableGroups, holdingsGroups, assetCurrent,
    activePctNum: activePct, passivePctNum: passivePct, cashPctNum: cashPct, totalValue: TOTAL,
    benchDefs, isHeld, companyMetrics, getPerformance, perfAvailable, analysisStocks, dividends, hasPrices,
    allocSeries, allocDates,
  };
}

// ---- allocation over time (REAL reconstruction, same conventions as today) ----
// Rebuilds holdings at monthly points over the last ~3 years (or since inception)
// and aggregates each allocation dimension exactly like the current donut: stocks
// by sector/country, equity funds looked-through by sector + assigned a mandate
// region, fixed income + cash as their own buckets, style = active / passive / cash.
// NOTE: fund sector weightings are Yahoo's CURRENT snapshot applied to past values
// (Yahoo exposes no historical composition), so the sector split drifts from exact
// further back; region / asset / style are exact (name- and type-derived).
const ALLOC_POINTS = 24;
function buildAllocSeries(
  asc: Txn[], prices: PriceMap, fallbackPx: Record<string, number>, keyOf: (t: Txn) => string, styleOverrides: StyleOverrides = {},
): { dates: string[]; series: Record<AllocDim, Record<string, number[]>> } {
  const series: Record<AllocDim, Record<string, number[]>> = { sector: {}, region: {}, asset: {}, style: {} };
  const dated = asc.filter((t) => t.date);
  if (!dated.length) return { dates: [], series };

  // static classification for every traded instrument
  const nameOf: Record<string, string> = {};
  dated.forEach((t) => { const k = keyOf(t); if (k && t.name && !nameOf[k]) nameOf[k] = t.name; });
  const uni = new Map<string, { cls: Cls; region: string; sw: Record<string, number> | null; hist: { d: number; v: number }[]; fb: number }>();
  dated.forEach((t) => {
    const k = keyOf(t);
    if (!k || shareSign(t.category) === 0 || uni.has(k)) return;
    const info = prices[t.isin] || prices[k];
    const cls = classify(nameOf[k] || k, info);
    const ov = styleOverrides[t.isin];
    if (ov && cls.sleeve !== "cash") cls.typeAP = ov;
    const region = cls.sleeve === "stocks" ? normRegion(info?.country) : cls.sleeve === "cash" ? "Cash" : fundRegion(nameOf[k] || k, info?.regionHint);
    uni.set(k, { cls, region, sw: cls.group === "EquityFunds" ? info?.sectorWeights ?? null : null, hist: sortedHist(info), fb: fallbackPx[t.isin || k] || t.price || 0 });
  });

  const N = ALLOC_POINTS;
  const startMs = Math.max(+new Date(dated[0].date), Date.now() - 3 * 365 * 864e5);
  const endMs = Date.now();
  const grid: number[] = [];
  for (let i = 0; i < N; i++) grid.push(Math.round(startMs + ((endMs - startMs) * i) / (N - 1)));

  const add = (dim: AllocDim, label: string, ti: number, v: number) => {
    (series[dim][label] ||= new Array(N).fill(0))[ti] += v;
  };

  const held: Record<string, number> = {};
  let cashBal = 0, ci = 0;
  for (let gi = 0; gi < N; gi++) {
    const gd = grid[gi];
    while (ci < dated.length && +new Date(dated[ci].date) <= gd) {
      const t = dated[ci];
      cashBal += t.amount || 0;
      const sign = shareSign(t.category), k = keyOf(t);
      if (sign !== 0 && k) held[k] = (held[k] || 0) + sign * t.qty;
      ci++;
    }
    let cashVal = Math.max(0, cashBal); // real cash + money-market funds accumulate here
    for (const [k, u] of uni) {
      const q = held[k];
      if (!q) continue;
      const v = q * asOf(u.hist, gd, u.fb);
      if (v <= 0) continue;
      if (u.cls.group === "Cash") { cashVal += v; continue; }
      // sector (equity funds looked-through)
      if (u.cls.group === "FixedIncomeFunds") add("sector", "Fixed income", gi, v);
      else if (u.cls.group === "EquityFunds") {
        const sw = u.sw, tot = sw ? Object.values(sw).reduce((s, w) => s + w, 0) : 0;
        if (sw && tot > 0) for (const [lab, w] of Object.entries(sw)) add("sector", lab, gi, v * (w / tot));
        else add("sector", "Equity fund (unclassified)", gi, v);
      } else add("sector", u.cls.sectorLabel, gi, v); // stocks
      add("region", u.region, gi, v);
      add("asset", u.cls.group === "Stocks" ? "Stocks" : u.cls.group === "EquityFunds" ? "Equity funds" : u.cls.group === "FixedIncomeFunds" ? "Fixed income" : "Other", gi, v);
      add("style", u.cls.typeAP === "passive" ? "Passive" : "Active", gi, v);
    }
    if (cashVal > 0) {
      add("sector", "Cash", gi, cashVal);
      add("region", "Cash", gi, cashVal);
      add("asset", "Cash & equivalents", gi, cashVal);
      add("style", "Cash & equivalents", gi, cashVal);
    }
  }

  // normalise each dimension to 100% at every time-step
  for (const dim of ["sector", "region", "asset", "style"] as AllocDim[]) {
    for (let ti = 0; ti < N; ti++) {
      let sum = 0;
      for (const lab in series[dim]) sum += series[dim][lab][ti];
      if (sum > 0) for (const lab in series[dim]) series[dim][lab][ti] = (series[dim][lab][ti] / sum) * 100;
    }
  }
  return { dates: grid.map((ms) => new Date(ms).toISOString().slice(0, 10)), series };
}

// ---- TWR engine (Own Capital methodology) ----
// Nordnet convention: RES_t = OC_t − OC_{t-1} − CF_t ; RET_t = RES_t / |OC_{t-1} + CFI_t| ;
// RETP = Π(1 + RET_t) − 1. OC = market value of holdings + cash. Only EXTERNAL movements
// (deposits, withdrawals, securities transfers) are cash flows (CF); buys, sells and
// DIVIDENDS are internal — a dividend's ex-div price drop and the received cash both sit
// inside OC, so it nets out automatically (no dividend credit needed, no double-count).
// We keep per-sleeve values + per-sleeve flows so the bucket toggles (stocks / equity
// funds / fixed income / other / cash) can compute the same identity on any subset
// (movements crossing the subset boundary become its CF).
type SleeveSeries = Record<PerfSleeve, number[]>;
const mkSeries = (): SleeveSeries => ({ stocks: [], eqFunds: [], fiFunds: [], other: [] });
interface TWR {
  dates: string[]; // YYYY-MM-DD weekly grid
  values: SleeveSeries; // market value per non-cash sleeve
  cashValue: number[]; // real cash balance + money-market funds
  extCash: number[]; // deposits + withdrawals (signed net), into the cash sleeve
  extCashIn: number[]; // deposits only (positive inflow part) → CFI
  buy: SleeveSeries; // cash → sleeve (buy cost)
  sell: SleeveSeries; // sleeve → cash (sell proceeds)
  div: SleeveSeries; // sleeve → cash (dividends)
  xIn: SleeveSeries; // securities transferred IN (market value, external)
  xOut: SleeveSeries; // securities transferred OUT
  bench: Record<string, number[]>; // per UI key, index level aligned to grid
}

function buildTWR(asc: Txn[], prices: PriceMap, fallbackPx: Record<string, number>, keyOf: (t: Txn) => string): TWR {
  const dated = asc.filter((t) => t.date);
  const empty: TWR = { dates: [], values: mkSeries(), cashValue: [], extCash: [], extCashIn: [], buy: mkSeries(), sell: mkSeries(), div: mkSeries(), xIn: mkSeries(), xOut: mkSeries(), bench: {} };
  if (!dated.length) return empty;

  const WEEK = 7 * 864e5;
  const startMs = +new Date(dated[0].date);
  const endMs = +new Date();
  // weekly grid, capped so very old accounts stay ~<=320 points
  let step = WEEK;
  let n = Math.floor((endMs - startMs) / step) + 1;
  if (n > 320) step = (endMs - startMs) / 319;
  const grid: number[] = [];
  for (let t = startMs; t <= endMs + 1; t += step) grid.push(Math.round(t));
  if (grid[grid.length - 1] < endMs) grid.push(endMs);
  const PN = grid.length;

  // classify every traded instrument (incl. since-sold) → sleeve + hist
  const universe = new Map<string, { sleeve: Sleeve; hist: { d: number; v: number }[]; fb: number }>();
  const nameOf: Record<string, string> = {};
  dated.forEach((t) => {
    const k = keyOf(t);
    if (k && t.name && !nameOf[k]) nameOf[k] = t.name;
  });
  dated.forEach((t) => {
    const k = keyOf(t);
    if (!k || shareSign(t.category) === 0 || universe.has(k)) return;
    const info = prices[t.isin] || prices[k];
    const cls = classify(nameOf[k] || k, info);
    universe.set(k, { sleeve: cls.sleeve, hist: sortedHist(info), fb: fallbackPx[t.isin || k] || t.price || 0 });
  });

  const held: Record<string, number> = {};
  const priceAt = (u: { hist: { d: number; v: number }[]; fb: number }, t: number) => asOf(u.hist, t, u.fb);

  const values = mkSeries();
  const cashValue: number[] = [];
  const extCash: number[] = [], extCashIn: number[] = [];
  const buy = mkSeries(), sell = mkSeries(), div = mkSeries(), xIn = mkSeries(), xOut = mkSeries();
  const zeros = (): Record<PerfSleeve, number> => ({ stocks: 0, eqFunds: 0, fiFunds: 0, other: 0 });

  let ti = 0;
  let cashBal = 0;

  for (let gi = 0; gi < PN; gi++) {
    const gd = grid[gi];
    // per-week flow buckets, classified by sleeve; external (deposit/withdrawal/transfer)
    // vs internal (buy/sell/dividend) — the split is what makes the OC identity hold.
    let eC = 0, eCI = 0;
    const wBuy = zeros(), wSell = zeros(), wDiv = zeros(), wXIn = zeros(), wXOut = zeros();
    while (ti < dated.length && +new Date(dated[ti].date) <= gd) {
      const t = dated[ti];
      cashBal += t.amount || 0;
      const sign = shareSign(t.category);
      const k = keyOf(t);
      const u = k ? universe.get(k) : undefined;
      if (sign !== 0 && k) held[k] = (held[k] || 0) + sign * t.qty;
      const sl = u && u.sleeve !== "cash" ? (u.sleeve as PerfSleeve) : null; // non-cash sleeve, else null
      const c = t.category;
      if (c === "deposit") { eC += t.amount || 0; eCI += Math.max(0, t.amount || 0); }
      else if (c === "withdrawal") { eC += t.amount || 0; } // amount is negative
      else if (c === "buy" && sl) { wBuy[sl] += t.acqValue > 0 ? t.acqValue : t.qty * t.price + t.fee; }
      else if (c === "sell" && sl) { wSell[sl] += t.qty * t.price - t.fee; }
      else if (c === "dividend" && sl) { wDiv[sl] += t.amount || 0; }
      else if (c === "transfer_in" && sl && u) { wXIn[sl] += t.qty * priceAt(u, +new Date(t.date)); }
      else if (c === "transfer_out" && sl && u) { wXOut[sl] += t.qty * priceAt(u, +new Date(t.date)); }
      // fee / tax / interest / other: internal, already reflected in cashBal (net-of-cost return)
      ti++;
    }
    // sleeve market values at this grid point
    const wVal = zeros();
    let vc = 0;
    for (const [k, u] of universe) {
      const q = held[k];
      if (!q) continue;
      const val = q * priceAt(u, gd);
      if (u.sleeve === "cash") vc += val; // money-market funds count as cash
      else wVal[u.sleeve as PerfSleeve] += val;
    }
    for (const s of PERF_SLEEVES) {
      values[s].push(wVal[s]);
      buy[s].push(wBuy[s]); sell[s].push(wSell[s]); div[s].push(wDiv[s]);
      xIn[s].push(wXIn[s]); xOut[s].push(wXOut[s]);
    }
    cashValue.push(Math.max(0, cashBal) + vc);
    extCash.push(eC); extCashIn.push(eCI);
  }

  // benchmarks aligned to grid
  const bench: Record<string, number[]> = {};
  for (const key of Object.keys(BENCH_SYMBOL)) {
    const info = prices[BENCH_SYMBOL[key]];
    const h = sortedHist(info);
    if (!h.length) continue;
    bench[key] = grid.map((gd) => asOf(h, gd, h[0].v));
  }

  const dates = grid.map((ms) => new Date(ms).toISOString().slice(0, 10));
  return { dates, values, cashValue, extCash, extCashIn, buy, sell, div, xIn, xOut, bench };
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dateLabel(d: string): string {
  const [y, m, day] = d.split("-");
  return parseInt(day, 10) + " " + MONTH_ABBR[parseInt(m, 10) - 1] + " " + y;
}
const WEEKS: Record<string, number> = { "1M": 4, "3M": 13, "6M": 26, "1Y": 52, "3Y": 156, "5Y": 260 };

function computePerformance(twr: TWR, benchKey: string, period: TrendPeriod, groups: PerfGroups): Performance {
  const PN = twr.dates.length;
  const emptyStat: PerfStat[] = [
    { k: "Return", v: "—", cls: "" }, { k: "vs index", v: "—", cls: "" },
    { k: "Volatility", v: "—", cls: "" }, { k: "Best week", v: "—", cls: "" },
  ];
  if (PN < 2) {
    return { a: [100], b: [100], dates: ["—"], perfPort: 0, perfBench: 0, perfPortStr: "—", perfBenchStr: "—", perfPortCls: "up", perfBenchCls: "up", perfStats: emptyStat, benchName: benchDefs[benchKey]?.label ?? "Index" };
  }
  let start = 0;
  if (period === "Max") start = 0;
  else if (period === "YTD") {
    const yr = twr.dates[PN - 1].slice(0, 4);
    const first = twr.dates.findIndex((d) => d >= yr + "-01-01");
    start = first > 0 ? first - 1 : 0;
  } else start = Math.max(0, PN - 1 - (WEEKS[period] ?? 52));

  // Own Capital of the selected subset = market value of its sleeves (+ cash if selected).
  const sel: Record<PerfSleeve, boolean> = { stocks: groups.stocks, eqFunds: groups.eqFunds, fiFunds: groups.fiFunds, other: groups.other };
  const selC = groups.cash;
  const OC = (t: number) => PERF_SLEEVES.reduce((s, k) => s + (sel[k] ? twr.values[k][t] : 0), 0) + (selC ? twr.cashValue[t] : 0);

  // A movement is a cash flow (CF) for the subset only when it CROSSES the subset boundary.
  // With the whole account selected, buys/sells/dividends are internal (net to 0) and only
  // deposits/withdrawals/transfers count — exactly the Nordnet Own Capital methodology.
  const a: number[] = [100];
  for (let t = start + 1; t < PN; t++) {
    const prev = OC(t - 1), cur = OC(t);
    let CF = 0, CFI = 0; // net flow, and inflow-only part (for the denominator)
    if (selC) { CF += twr.extCash[t]; CFI += twr.extCashIn[t]; } // deposits/withdrawals hit cash
    for (const k of PERF_SLEEVES) {
      const on = sel[k];
      const buy = twr.buy[k][t], sell = twr.sell[k][t], div = twr.div[k][t];
      if (on) { CF += twr.xIn[k][t] - twr.xOut[k][t]; CFI += twr.xIn[k][t]; } // transfers are external to the account
      if (on && !selC) { CF += buy - sell - div; CFI += buy; } // cash is outside: buy in, sell/div out
      else if (!on && selC) { CF += sell + div - buy; CFI += sell + div; } // sleeve outside: sell/div in
      // on && selC → fully internal (no CF); !on && !selC → does not touch the subset
    }
    const denom = Math.abs(prev + CFI);
    const ret = denom > 1e-6 ? (cur - prev - CF) / denom : 0;
    a.push(a[a.length - 1] * (1 + ret));
  }

  const benchRaw = (twr.bench[benchKey] || twr.bench.OMXH25 || []).slice(start);
  const b = benchRaw.length && benchRaw[0] ? benchRaw.map((v) => (v / benchRaw[0]) * 100) : a.map(() => 100);
  const dates = twr.dates.slice(start).map(dateLabel);

  const perfPort = a[a.length - 1] - 100;
  const perfBench = b.length ? b[b.length - 1] - 100 : 0;
  const rets: number[] = [];
  for (let i = 1; i < a.length; i++) rets.push(a[i] / a[i - 1] - 1);
  const mean = rets.reduce((s, r) => s + r, 0) / (rets.length || 1);
  const vol = Math.sqrt(rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length || 1)) * Math.sqrt(52) * 100;
  const best = rets.length ? Math.max(...rets) * 100 : 0;

  return {
    a, b, dates, perfPort, perfBench,
    perfPortStr: sgn(perfPort), perfBenchStr: sgn(perfBench),
    perfPortCls: perfPort >= 0 ? "up" : "down", perfBenchCls: perfBench >= 0 ? "up" : "down",
    perfStats: [
      { k: "Return", v: sgn(perfPort), cls: perfPort >= 0 ? "up" : "down" },
      { k: "vs index", v: sgn(perfPort - perfBench), cls: perfPort - perfBench >= 0 ? "up" : "down" },
      { k: "Volatility", v: vol.toFixed(1) + "%", cls: "" },
      { k: "Best week", v: sgn(best), cls: "up" },
    ],
    benchName: benchDefs[benchKey]?.label ?? "Index",
  };
}
