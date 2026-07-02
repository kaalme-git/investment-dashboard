// ============================================================================
// Portfolio SHAPES (types) shared across the UI. All live values are computed
// dynamically from transactions + fetched prices in `live.ts` and delivered via
// the store (see useStore → portfolio). This module intentionally holds NO data.
// ============================================================================

import type { AllocSeg, PerfStat, TableGroup } from "./types";

export const ACCENT = "#0000e6";

export type TrendPeriod = "1M" | "3M" | "6M" | "YTD" | "1Y" | "3Y" | "5Y" | "Max";

export interface Kpi {
  label: string;
  value: string;
  cls: "" | "up" | "down";
}

export interface HoldRow {
  ticker: string;
  name: string;
  typeLbl: string;
  typeCls: string;
  sector: string;
  sharesStr: string;
  avgStr: string;
  lastStr: string;
  valueStr: string;
  dayStr: string;
  dayCls: "" | "up" | "down";
  totalStr: string;
  totCls: "" | "up" | "down";
  yieldStr: string;
  weightStr: string;
  recShort: string;
  recCls: string;
}

export interface HoldGroup {
  key: TableGroup["key"];
  label: string;
  valueStr: string;
  pctStr: string;
  rows: HoldRow[];
}

export interface CompanyMetrics {
  name: string;
  sector: string;
  region: string;
  lastStr: string;
  valueStr: string;
  dayStr: string;
  dayCls: "up" | "down";
  totalStr: string;
  totCls: "up" | "down";
  weightStr: string;
  sharesStr: string;
  avgStr: string;
  yieldStr: string;
  recShort: string;
  recCls: string;
  targetStr: string;
  // which allocation buckets this instrument is sorted into (per view)
  bucketSector: string; // stock → its sector; equity fund → "Look-through"; FI → "Fixed income"; cash → "Cash"
  bucketRegion: string;
  bucketAsset: string; // Stocks | Equity funds | Fixed income | Cash & equivalents
  bucketStyle: string; // Active | Passive | Cash & equivalents (effective, incl. override)
  fundSectors: { label: string; pctStr: string }[] | null; // equity funds: look-through sector split
  clsVars: { k: string; v: string }[]; // raw variables used to derive the buckets
  isin: string; // for setting a per-instrument style override
  styleAuto: string; // the auto (non-overridden) style classification
  styleOverridden: boolean; // whether the user has manually set active/passive
}

/** One instrument's contribution to an allocation bucket (drill-down detail). */
export interface AllocContribution {
  ticker: string;
  name: string;
  value: number; // contributed € (for sorting)
  valueStr: string;
  pctStr: string; // share of the whole portfolio
  note?: string; // e.g. "24% of fund" for looked-through equity-fund slices
}

export interface PerfGroups {
  stocks: boolean;
  funds: boolean;
  cash: boolean;
}

export interface Performance {
  a: number[]; // portfolio TWR index (rebased to 100 at period start)
  b: number[]; // benchmark index (rebased to 100)
  dates: string[];
  perfPort: number;
  perfBench: number;
  perfPortStr: string;
  perfBenchStr: string;
  perfPortCls: "up" | "down";
  perfBenchCls: "up" | "down";
  perfStats: PerfStat[];
  benchName: string;
}

// re-export so existing imports of `AllocSeg` via portfolio keep working if any
export type { AllocSeg };
