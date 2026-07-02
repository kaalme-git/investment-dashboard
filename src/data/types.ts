// ============================================================================
// DATA CONTRACT
// These shapes mirror the prototype's mock data (renderVals). A real backend /
// market-data + Inderes connector should satisfy these field names + shapes.
// ============================================================================

export type Rec = "Buy" | "Accumulate" | "Hold" | "Reduce" | "Sell";

export type AllocDim = "sector" | "region" | "asset" | "style";

/** A directly-held stock. */
export interface Stock {
  name: string;
  ticker: string;
  sector: string;
  region: string;
  last: number;
  value: number;
  dayPct: number;
  totalPct: number;
  rec: Rec | null;
  seed: number;
}

/** A fund / ETF / cash-equivalent instrument. */
export interface Fund {
  name: string;
  ticker: string;
  kind: string; // ETF, Index fund, Bond fund, ETC, Cash eq.
  type: "active" | "passive";
  group: HoldingGroup;
  sector: string;
  region: string;
  last: number;
  value: number;
  dayPct: number;
  totalPct: number;
  rec: Rec | null;
  divYield: number;
  seed: number;
}

export type HoldingGroup =
  | "Stocks"
  | "EquityFunds"
  | "FixedIncomeFunds"
  | "Other" // anything that fits no other bucket (was "AltFunds")
  | "Cash";

/** One slice of an allocation breakdown (donut + legend + stacked area). */
export interface AllocSeg {
  label: string;
  pctNum: number;
  color: string;
  pctStr: string;
}

/** A row in the grouped holdings/overview table. */
export interface TableRow {
  ticker: string;
  name: string;
  sector: string;
  lastStr: string;
  weightStr: string;
  valueStr: string;
  totalStr: string;
  totCls: "" | "up" | "down";
  recShort: string;
  recCls: string;
  typeLbl: string;
  typeCls: string;
  sparkData: number[] | null; // real ~3-month weekly closes (EUR); null if unavailable
  sparkUp: boolean;
}

export interface TableGroup {
  key: HoldingGroup;
  label: string;
  valueStr: string;
  pctStr: string;
  rows: TableRow[];
}

export interface PerfStat {
  k: string;
  v: string;
  cls: "" | "up" | "down";
}

export interface BenchDef {
  label: string;
  drift: number;
  vol: number;
  seed: number;
}
