// Inderes research feed — ported from the prototype's RES dataset.
// In production these come from the Inderes connector (MCP / API).

import type { Rec } from "./types";

export type ResTab = "equity" | "market" | "macro";

export interface ResItem {
  id: string;
  tab: ResTab;
  kind: "Report" | "Update" | "News";
  company?: string;
  ticker?: string;
  tag?: string;
  title: string;
  rec?: Rec;
  date: string;
  premium?: boolean;
}

const recCls: Record<Rec, string> = { Buy: "buy", Accumulate: "accu", Hold: "hold", Reduce: "redu", Sell: "sell" };
const recShort: Record<Rec, string> = { Buy: "Buy", Accumulate: "Accu.", Hold: "Hold", Reduce: "Reduce", Sell: "Sell" };
const resBadge: Record<string, string> = { Report: "rb-rep", Update: "rb-upd", News: "rb-news" };

const RAW: Record<ResTab, Omit<ResItem, "id" | "tab">[]> = {
  equity: [
    { kind: "Report", company: "ASML Holding", ticker: "ASML", title: "Q2 review: order intake stabilising, 2026 guidance intact", rec: "Accumulate", date: "Jun 27, 2026", premium: true },
    { kind: "News", company: "Novo Nordisk", ticker: "NOVO-B", title: "CagriSema Phase 3 read-out expected next week", date: "Jun 30, 2026" },
    { kind: "Report", company: "Sampo", ticker: "SAMPO", title: "P&C margins justify the premium — estimates raised", rec: "Buy", date: "Jun 24, 2026", premium: true },
    { kind: "Update", company: "Nordea Bank", ticker: "NDA-FI", title: "Rate cuts weigh on NII; target trimmed", rec: "Buy", date: "Jun 23, 2026" },
    { kind: "Report", company: "Evolution AB", ticker: "EVO", title: "Watchlist initiation: regulatory overhang vs. growth", rec: "Accumulate", date: "Jun 20, 2026", premium: true },
    { kind: "News", company: "Nokia", ticker: "NOKIA", title: "Wins 5G core network deal with major US carrier", date: "Jun 26, 2026" },
    { kind: "News", company: "Neste", ticker: "NESTE", title: "SAF spreads weaken; H2 margin guidance at risk", date: "Jun 25, 2026" },
  ],
  market: [
    { kind: "Report", tag: "Financials", title: "Nordic banks: the post-rate-cut earnings reset", date: "Jun 28, 2026", premium: true },
    { kind: "Report", tag: "Strategy", title: "Helsinki small & mid-caps — H2 2026 outlook", date: "Jun 22, 2026", premium: true },
    { kind: "News", tag: "Markets", title: "OMX Helsinki 25 hits 6-month high, led by industrials", date: "Jun 30, 2026" },
    { kind: "Report", tag: "Technology", title: "Semiconductors: is the capex cycle turning?", date: "Jun 19, 2026" },
  ],
  macro: [
    { kind: "Report", tag: "Rates", title: "ECB: one more cut, then a long pause", date: "Jun 29, 2026", premium: true },
    { kind: "News", tag: "Inflation", title: "Euro-area inflation cools to 2.1% in June", date: "Jun 30, 2026" },
    { kind: "Report", tag: "Finland", title: "Finland macro: recovery gains traction in 2026", date: "Jun 21, 2026" },
    { kind: "News", tag: "United States", title: "US labour market softens; Fed cut odds rise", date: "Jun 27, 2026" },
  ],
};

export const RESEARCH: ResItem[] = (Object.keys(RAW) as ResTab[]).flatMap((tab) =>
  RAW[tab].map((x, i) => ({ ...x, tab, id: `${tab}-${i}` })),
);

export function researchByTab(tab: ResTab): ResItem[] {
  return RESEARCH.filter((r) => r.tab === tab);
}

export function reportsForTicker(ticker: string): ResItem[] {
  return RESEARCH.filter((r) => r.tab === "equity" && r.ticker === ticker);
}

export function findReport(id: string): ResItem | undefined {
  return RESEARCH.find((r) => r.id === id);
}

/** Display fields for a research card (shared by Research feed + Company page). */
export interface ResDisplay {
  id: string;
  kind: string;
  title: string;
  date: string;
  kindCls: string;
  sub: string;
  premium: boolean;
  hasRec: boolean;
  recCls: string;
  recShort: string;
}

export function mapRes(x: ResItem): ResDisplay {
  return {
    id: x.id,
    kind: x.kind,
    title: x.title,
    date: x.date,
    kindCls: "resb " + (resBadge[x.kind] || "rb-news"),
    sub: x.company ? `${x.company} · ${x.ticker}` : x.tag || "",
    premium: !!x.premium,
    hasRec: !!x.rec,
    recCls: x.rec ? recCls[x.rec] : "na",
    recShort: x.rec ? recShort[x.rec] : "",
  };
}
