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
