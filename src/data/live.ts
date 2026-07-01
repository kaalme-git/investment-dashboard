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
import type { Kpi, HoldRow, HoldGroup, CompanyMetrics, Performance, PerfGroups, TrendPeriod } from "./portfolio";

export const ACCENT = "#0000e6";
const GREY = "#d9d9d9";
// blue-family palette; slices are coloured by descending weight so the model
// stays generic for any set of sector / region / asset labels.
const PALETTE = [ACCENT, "#2e2eff", "#5a5aff", "#6b6bff", "#8585ff", "#a8a8ff", "#c49cff", "#91a77f", "#b6c9a3", "#8fae86", "#9aa7c2"];

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
  moneyMarket?: boolean;
  divYield?: number;
  price?: number;
  prevClose?: number;
  history?: { date: string; close: number }[];
  // Inderes analyst data (populated for covered companies; publicly shown on inderes.fi)
  rec?: string | null; // raw enum: BUY | INCREASE | HOLD | REDUCE | SELL
  targetPrice?: number | null;
  recDate?: string | null;
}
export type PriceMap = Record<string, PriceInfo>;

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

type Sleeve = "stocks" | "funds" | "cash";

// ---- generic classification ----
interface Cls {
  sleeve: Sleeve;
  group: HoldingGroup;
  kind: string; // Stock | ETF | Index fund | Bond fund | Cash eq.
  typeAP: "active" | "passive";
  sectorLabel: string; // for allocation (funds → asset-class label)
  assetLabel: "Equities" | "Fixed income" | "Alternatives" | "Cash & equivalent";
}
function classify(name: string, info?: PriceInfo): Cls {
  const t = info?.type;
  const mm = info?.moneyMarket || MM_NAME_RE.test(name);
  const looksFund = isFund(t) || (!t && FUND_NAME_RE.test(name));

  if (t === "EQUITY" || (!t && !looksFund && !mm)) {
    return { sleeve: "stocks", group: "Stocks", kind: "Stock", typeAP: "active", sectorLabel: normSector(info?.sector), assetLabel: "Equities" };
  }
  if (mm) {
    return { sleeve: "cash", group: "Cash", kind: "Cash eq.", typeAP: "passive", sectorLabel: "Cash equivalent", assetLabel: "Cash & equivalent" };
  }
  // fund / etf
  const ac = info?.assetClass || (FI_NAME_RE.test(name) ? "Fixed Income" : "Equity");
  if (ac === "Fixed Income") {
    return { sleeve: "funds", group: "FixedIncomeFunds", kind: "Bond fund", typeAP: "passive", sectorLabel: "Fixed income fund", assetLabel: "Fixed income" };
  }
  const kind = t === "MUTUALFUND" ? "Index fund" : "ETF";
  return { sleeve: "funds", group: "EquityFunds", kind, typeAP: "passive", sectorLabel: "Equity fund", assetLabel: "Equities" };
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
function normRegion(country?: string | null, fund?: boolean): string {
  if (fund) return "Global";
  if (!country) return "Other";
  if (/united states|usa/i.test(country)) return "USA";
  return country;
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
  divYield: number;
  seed: number;
  cls: Cls;
  region: string;
  recShort: string;
  recCls: string;
  targetPrice: number | null;
  spark: number[]; // last ~13 weekly closes (EUR) for the 3-month sparkline
}

const shareSign = (c: string): number => (c === "buy" || c === "transfer_in" ? 1 : c === "sell" || c === "transfer_out" ? -1 : 0);

// last known transaction price per isin (fallback when no market feed)
function lastTxnPrice(txns: Txn[]): Record<string, number> {
  const m: Record<string, number> = {};
  txns
    .filter((t) => t.price > 0 && (t.isin || t.ticker))
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
  tableGroups: TableGroup[];
  holdingsGroups: HoldGroup[];
  assetCurrent: Record<string, number>;
  activePctNum: number;
  passivePctNum: number;
  totalValue: number;
  benchDefs: Record<string, BenchDef>;
  isHeld: (ticker: string) => boolean;
  companyMetrics: (ticker: string) => CompanyMetrics | null;
  getPerformance: (benchKey: string, period: TrendPeriod, groups: PerfGroups) => Performance;
  hasPrices: boolean;
}

const recStub = { recShort: "—", recCls: "na" };

export function buildPortfolio(txns: Txn[], prices: PriceMap): Portfolio {
  const keyOf = (t: Txn) => t.isin || t.ticker || t.name;
  const fallbackPx = lastTxnPrice(txns);

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

  // ---- current securities ----
  const secs: Sec[] = Object.values(pos)
    .filter((p) => p.qty > 1e-6)
    .map((p) => {
      const info = priceOf(p.isin);
      const cls = classify(p.name, info);
      const last = info?.found && info.price ? info.price : fallbackPx[p.isin] || (p.qty ? p.cost / p.qty : 0);
      const prev = info?.found && info.prevClose ? info.prevClose : last;
      const value = p.qty * last;
      const cost = p.cost;
      const rd = recOf(info?.rec);
      return {
        isin: p.isin,
        name: p.name,
        ticker: tickerFrom(info?.symbol, p.name, p.ticker || p.isin),
        qty: p.qty,
        cost,
        last,
        value,
        dayPct: prev ? (last / prev - 1) * 100 : 0,
        totalPct: cost > 0 ? (value / cost - 1) * 100 : 0,
        divYield: info?.divYield || 0,
        seed: hashInt(p.isin),
        cls,
        region: normRegion(info?.country, cls.sleeve !== "stocks"),
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
  const totRetPct = investCost > 0 ? ((holdingsValue - investCost) / investCost) * 100 : 0;
  const dayAbs = secs.reduce((s, h) => s + (h.value * h.dayPct) / 100, 0);
  const dayPct = TOTAL - dayAbs !== 0 ? (dayAbs / (TOTAL - dayAbs)) * 100 : 0;
  const divIncome = investable.reduce((s, h) => s + (h.value * h.divYield) / 100, 0);
  const divYield = (divIncome / safeTotal) * 100;
  const passiveValue = secs.filter((h) => h.cls.typeAP === "passive").reduce((s, h) => s + h.value, 0);
  const passivePct = (passiveValue / safeTotal) * 100;
  const activePct = ((TOTAL - passiveValue) / safeTotal) * 100;

  const kpis: Kpi[] = [
    { label: "Total value", value: eur(TOTAL), cls: "" },
    { label: "Today", value: sgn(dayPct, 2), cls: dayPct >= 0 ? "up" : "down" },
    { label: "Total return", value: sgn(totRetPct), cls: totRetPct >= 0 ? "up" : "down" },
    { label: "Holdings", value: eur(holdingsValue), cls: "" },
    { label: "Cash", value: eur(cashTotal), cls: "" },
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

  function aggBy(fn: (h: Sec) => string): { label: string; pct: number }[] {
    const m: Record<string, number> = {};
    investable.forEach((h) => (m[fn(h)] = (m[fn(h)] || 0) + h.value));
    m.Cash = (m.Cash || 0) + cashTotal;
    return Object.keys(m).map((label) => ({ label, pct: (m[label] / safeTotal) * 100 }));
  }

  const sectorSeg = buildSeg(aggBy((h) => h.cls.sectorLabel));
  const regionSeg = buildSeg(aggBy((h) => h.region));
  const assetSeg = buildSeg(aggBy((h) => h.cls.assetLabel));
  const styleSeg = buildSeg([
    { label: "Active", pct: activePct },
    { label: "Passive", pct: passivePct },
  ]);
  // style colours: active accent, passive violet (keep legacy look)
  styleSeg.forEach((s) => (s.color = s.label === "Active" ? ACCENT : "#c49cff"));

  const allocMap: Record<AllocDim, AllocSeg[]> = { sector: sectorSeg, region: regionSeg, asset: assetSeg, style: styleSeg };
  const allocModeLbl: Record<AllocDim, string> = { sector: "sector", region: "region", asset: "asset-class", style: "active vs passive" };

  const assetCurrent: Record<string, number> = {};
  assetSeg.forEach((s) => (assetCurrent[s.label] = s.pctNum));

  // ---- grouped tables ----
  const grpMeta: { key: HoldingGroup; label: string }[] = [
    { key: "Stocks", label: "Stocks" },
    { key: "EquityFunds", label: "Equity funds" },
    { key: "FixedIncomeFunds", label: "Fixed income funds" },
    { key: "AltFunds", label: "Alternative funds" },
    { key: "Cash", label: "Cash & cash equivalents" },
  ];
  const tagOf: Record<string, [string, string]> = {
    Stock: ["Stock", "act"],
    ETF: ["ETF", "pas"],
    "Index fund": ["Index", "pas"],
    "Bond fund": ["Bond", "pas"],
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
      valueStr: eur(h.value),
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
    weightStr: ((CASH_V / safeTotal) * 100).toFixed(1) + "%", valueStr: eur(CASH_V),
    totalStr: "—", totCls: "", ...recStub, typeLbl: "Cash", typeCls: "tp csh", sparkData: null, sparkUp: true,
  };
  const tableGroups: TableGroup[] = grpMeta
    .map((g) => {
      const items = secs.filter((h) => h.cls.group === g.key).map(rowOf);
      const rows = g.key === "Cash" ? [...items, cashRow] : items;
      const val = gVal(g.key);
      return { key: g.key, label: g.label, valueStr: eur(val), pctStr: ((val / safeTotal) * 100).toFixed(1) + "%", rows };
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
      valueStr: eur(h.value),
      dayStr: sgn(h.dayPct),
      dayCls: h.dayPct >= 0 ? "up" : "down",
      totalStr: sgn(h.totalPct),
      totCls: h.totalPct >= 0 ? "up" : "down",
      yieldStr: h.divYield ? h.divYield.toFixed(1) + "%" : "—",
      weightStr: ((h.value / safeTotal) * 100).toFixed(1) + "%",
      recShort: h.recShort,
      recCls: h.recCls,
    };
  };
  const cashRowFull: HoldRow = {
    ticker: "CASH", name: "Cash balance (EUR)", typeLbl: "Cash", typeCls: "tp csh", sector: "—",
    sharesStr: "—", avgStr: "—", lastStr: "—", valueStr: eur(CASH_V), dayStr: "—", dayCls: "",
    totalStr: "—", totCls: "", yieldStr: "—", weightStr: ((CASH_V / safeTotal) * 100).toFixed(1) + "%", ...recStub,
  };
  const holdingsGroups: HoldGroup[] = grpMeta
    .map((g) => {
      const items = secs.filter((h) => h.cls.group === g.key).map(rowFull);
      const rows = g.key === "Cash" ? [...items, cashRowFull] : items;
      const val = gVal(g.key);
      return { key: g.key, label: g.label, valueStr: eur(val), pctStr: ((val / safeTotal) * 100).toFixed(1) + "%", rows };
    })
    .filter((g) => g.rows.length);

  // ---- per-ticker lookup ----
  const byTicker: Record<string, Sec> = {};
  secs.forEach((h) => (byTicker[h.ticker] = h));
  const isHeld = (ticker: string) => !!byTicker[ticker];
  const companyMetrics = (ticker: string): CompanyMetrics | null => {
    const h = byTicker[ticker];
    if (!h) return null;
    return {
      name: h.name,
      sector: h.cls.sectorLabel,
      region: h.region,
      lastStr: h.last.toFixed(2),
      valueStr: eur(h.value),
      dayStr: sgn(h.dayPct),
      dayCls: h.dayPct >= 0 ? "up" : "down",
      totalStr: sgn(h.totalPct),
      totCls: h.totalPct >= 0 ? "up" : "down",
      weightStr: ((h.value / safeTotal) * 100).toFixed(1) + "%",
      sharesStr: h.qty.toLocaleString("en-US", { maximumFractionDigits: 2 }),
      avgStr: "€" + (h.qty ? h.cost / h.qty : 0).toFixed(2),
      yieldStr: h.divYield ? h.divYield.toFixed(1) + "%" : "—",
      recShort: h.recShort,
      recCls: h.recCls,
      targetStr: h.targetPrice ? "€" + h.targetPrice.toFixed(2) : "—",
    };
  };

  // ==========================================================================
  // TWR reconstruction over a weekly grid (true historical account incl. sold)
  // ==========================================================================
  const perf = buildTWR(asc, prices, fallbackPx, keyOf);

  function getPerformance(benchKey: string, period: TrendPeriod, groups: PerfGroups): Performance {
    return computePerformance(perf, benchKey, period, groups);
  }

  return {
    kpis, allocMap, allocModeLbl, tableGroups, holdingsGroups, assetCurrent,
    activePctNum: activePct, passivePctNum: passivePct, totalValue: TOTAL,
    benchDefs, isHeld, companyMetrics, getPerformance, hasPrices,
  };
}

// ---- TWR engine ----
interface TWR {
  dates: string[]; // YYYY-MM-DD weekly grid
  stocksValue: number[];
  fundsValue: number[];
  cashValue: number[];
  rStocks: number[];
  rFunds: number[];
  bench: Record<string, number[]>; // per UI key, index level aligned to grid
}

function buildTWR(asc: Txn[], prices: PriceMap, fallbackPx: Record<string, number>, keyOf: (t: Txn) => string): TWR {
  const dated = asc.filter((t) => t.date);
  if (!dated.length) return { dates: [], stocksValue: [], fundsValue: [], cashValue: [], rStocks: [], rFunds: [], bench: {} };

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
  const sleeveVal = (sl: Sleeve, t: number): number => {
    let v = 0;
    for (const [k, u] of universe) {
      if (u.sleeve !== sl || !held[k]) continue;
      v += held[k] * asOf(u.hist, t, u.fb);
    }
    return v;
  };

  const stocksValue: number[] = [];
  const fundsValue: number[] = [];
  const cashValue: number[] = [];
  const rStocks: number[] = [];
  const rFunds: number[] = [];

  let ti = 0;
  let cashBal = 0;
  const flow: Record<Sleeve, number> = { stocks: 0, funds: 0, cash: 0 };

  for (let gi = 0; gi < PN; gi++) {
    const gd = grid[gi];
    flow.stocks = 0; flow.funds = 0; flow.cash = 0;
    // apply all txns up to this grid point
    while (ti < dated.length && +new Date(dated[ti].date) <= gd) {
      const t = dated[ti];
      cashBal += t.amount || 0;
      const sign = shareSign(t.category);
      const k = keyOf(t);
      if (sign !== 0 && k) {
        const u = universe.get(k);
        held[k] = (held[k] || 0) + sign * t.qty;
        if (u && u.sleeve !== "cash") {
          // external flow into the sleeve (market value for transfers, cash for trades)
          if (t.category === "buy") flow[u.sleeve] += t.acqValue > 0 ? t.acqValue : t.qty * t.price + t.fee;
          else if (t.category === "sell") flow[u.sleeve] -= t.qty * t.price - t.fee;
          else if (t.category === "transfer_in") flow[u.sleeve] += t.qty * asOf(u.hist, +new Date(t.date), u.fb);
          else if (t.category === "transfer_out") flow[u.sleeve] -= t.qty * asOf(u.hist, +new Date(t.date), u.fb);
        }
      }
      ti++;
    }
    const vs = sleeveVal("stocks", gd);
    const vf = sleeveVal("funds", gd);
    const vc = Math.max(0, cashBal) + sleeveVal("cash", gd); // cash + money-market funds
    stocksValue.push(Math.round(vs));
    fundsValue.push(Math.round(vf));
    cashValue.push(Math.round(vc));
    if (gi === 0) { rStocks.push(0); rFunds.push(0); }
    else {
      const ps = stocksValue[gi - 1], pf = fundsValue[gi - 1];
      rStocks.push(ps > 0 ? (vs - ps - flow.stocks) / ps : 0);
      rFunds.push(pf > 0 ? (vf - pf - flow.funds) / pf : 0);
    }
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
  return { dates, stocksValue, fundsValue, cashValue, rStocks, rFunds, bench };
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

  const sleeves = [
    { on: groups.stocks, val: twr.stocksValue, r: twr.rStocks },
    { on: groups.funds, val: twr.fundsValue, r: twr.rFunds },
    { on: groups.cash, val: twr.cashValue, r: null as number[] | null },
  ].filter((s) => s.on);

  const a: number[] = [100];
  for (let t = start + 1; t < PN; t++) {
    const denom = sleeves.reduce((s, sl) => s + sl.val[t - 1], 0);
    let cr = 0;
    if (denom > 0) for (const sl of sleeves) cr += (sl.val[t - 1] / denom) * (sl.r ? sl.r[t] : 0);
    a.push(a[a.length - 1] * (1 + cr));
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
