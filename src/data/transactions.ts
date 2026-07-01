// CSV import + position/history derivation.
// Handles BOTH the simple demo format (comma, English headers, period decimals)
// AND real Nordnet exports (tab, Finnish headers, comma decimals, UTF-16, no
// ticker — only ISIN + security name, plus securities transfers & cash events).

import { eur } from "./format";

export type TxCategory =
  | "buy"
  | "sell"
  | "dividend"
  | "deposit"
  | "withdrawal"
  | "tax"
  | "interest"
  | "transfer_in"
  | "transfer_out"
  | "fee"
  | "other";

export interface Txn {
  id: string; // stable per-transaction id (Nordnet "Id"); used to dedupe re-imports
  date: string;
  rawType: string;
  category: TxCategory;
  name: string;
  ticker: string;
  isin: string;
  qty: number;
  price: number;
  fee: number;
  amount: number; // signed cash effect (Nordnet "Summa"); 0 if unknown
  acqValue: number; // acquisition value (Nordnet "Hankinta-arvo"); 0 if unknown
  ccy: string;
}

export const SAMPLE_CSV = `date,type,ticker,name,quantity,price,fee,currency
2021-01-20,Buy,NOKIA,Nokia,800,3.90,5,EUR
2021-03-12,Buy,ASML,ASML Holding,18,480.00,8,EUR
2021-05-20,Buy,NOVO-B,Novo Nordisk,160,52.00,6,EUR
2021-09-02,Buy,MSFT,Microsoft,30,290.00,9,EUR
2022-01-18,Buy,SAMPO,Sampo,300,38.50,6,EUR
2022-04-06,Buy,IWDA,iShares Core MSCI World,160,72.00,5,EUR
2022-08-22,Buy,AAPL,Apple,90,150.00,8,EUR
2023-02-10,Sell,NOKIA,Nokia,500,4.50,5,EUR
2023-06-15,Buy,NESTE,Neste,400,38.00,6,EUR
2023-11-30,Dividend,SAMPO,Sampo,300,1.80,0,EUR
2024-03-04,Buy,SGLN,iShares Physical Gold,180,42.00,4,EUR
2024-09-19,Sell,NESTE,Neste,200,18.00,5,EUR
2025-01-15,Buy,KNEBV,Kone,120,45.00,6,EUR`;

// ---- number parsing (European comma-decimal aware) ----
export function parseNum(v: string | undefined): number {
  if (v == null) return 0;
  let s = ("" + v).trim().replace(/\s/g, "").replace(/[€$£]/g, "");
  if (s === "") return 0;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // the last separator is the decimal point
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  s = s.replace(/[^0-9.\-]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// ---- transaction-type classification (Finnish + English) ----
export function classify(raw: string): TxCategory {
  const U = (raw || "").toUpperCase();
  if (/MYYNTI|SELL|SALE|\bSLD\b/.test(U)) return "sell";
  if (/NOSTO|WITHDRAW|UTTAG/.test(U)) return "withdrawal";
  if (/\bOSTO\b|\bBUY\b|MERKINTÄ/.test(U)) return "buy";
  if (/ENNAKKOPID|LÄHDEVERO|LAHDEVERO|\bTAX\b|VERO|WITHHOLD/.test(U)) return "tax";
  if (/OSINKO|DIVIDEND|\bDIV\b|UTDELNING/.test(U)) return "dividend";
  if (/KORKO|INTEREST|RÄNTA|RANTA/.test(U)) return "interest";
  if (/TALLETUS|DEPOSIT|INSÄTTNING|INSATTNING/.test(U)) return "deposit";
  if (/NOSTO|WITHDRAW|UTTAG/.test(U)) return "withdrawal";
  if (/JÄTTÖ|JATTO|JÄTTO|RAHASTOANTI/.test(U)) return "transfer_in";
  if (/OTTO|LUNASTUS/.test(U)) return "transfer_out";
  if (/MAKSU|\bFEE\b|COURTAGE|KULU/.test(U)) return "fee";
  return "other";
}

const TYPE_LABEL: Record<TxCategory, string> = {
  buy: "Buy",
  sell: "Sell",
  dividend: "Dividend",
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  tax: "Tax",
  interest: "Interest",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
  fee: "Fee",
  other: "Other",
};
const TYPE_CLS: Record<TxCategory, string> = {
  buy: "tx-buy",
  sell: "tx-sell",
  dividend: "tx-div",
  deposit: "tx-cash",
  withdrawal: "tx-cash",
  tax: "tx-tax",
  interest: "tx-cash",
  transfer_in: "tx-xfer",
  transfer_out: "tx-xfer",
  fee: "tx-tax",
  other: "tx-neutral",
};

// share-count effect of a category
function shareSign(c: TxCategory): 0 | 1 | -1 {
  if (c === "buy" || c === "transfer_in") return 1;
  if (c === "sell" || c === "transfer_out") return -1;
  return 0;
}

// ---- delimiter + header detection ----
function detectDelimiter(headerLine: string): string {
  const counts: Record<string, number> = {
    "\t": (headerLine.match(/\t/g) || []).length,
    ";": (headerLine.match(/;/g) || []).length,
    ",": (headerLine.match(/,/g) || []).length,
  };
  return Object.keys(counts).reduce((a, b) => (counts[b] > counts[a] ? b : a), "\t");
}

const ALIASES: Record<string, string[]> = {
  id: ["id", "tapahtumatunnus", "transaction id", "reference", "verification number", "vahvistusnumero"],
  date: ["kauppapäivä", "kauppapaiva", "kirjauspäivä", "kirjauspaiva", "date", "pvm", "päivä", "paiva", "trade date", "transaction date", "affärsdag"],
  type: ["tapahtumatyyppi", "type", "action", "side", "transaction type", "event", "transaktionstyp"],
  name: ["arvopaperi", "name", "nimi", "security", "instrument", "värdepapper", "vardepapper"],
  isin: ["isin"],
  ticker: ["ticker", "symbol", "osake"],
  qty: ["määrä", "maara", "quantity", "qty", "shares", "units", "antal"],
  price: ["kurssi", "price", "hinta", "kurs"],
  fee: ["kokonaiskulut", "välityspalkkio", "valityspalkkio", "fee", "fees", "commission", "kulut", "courtage"],
  amount: ["summa", "amount", "belopp", "total"],
  acq: ["hankinta-arvo", "hankinta-arvo", "hankinta", "acquisition", "gav", "anskaffningsvärde"],
  ccy: ["valuutta", "currency", "ccy", "valuta"],
};

export function parseCsv(text: string): Txn[] {
  const lines = ("" + text).replace(/^﻿/, "").trim().split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const delim = detectDelimiter(lines[0]);
  const head = lines[0].split(delim).map((s) => s.trim().toLowerCase().replace(/^"|"$/g, ""));
  const idx = (key: string) => head.findIndex((h) => ALIASES[key].indexOf(h) >= 0);
  const idi = idx("id");
  const di = idx("date");
  const ti = idx("type");
  const ni = idx("name");
  const isi = idx("isin");
  const ki = idx("ticker");
  const qi = idx("qty");
  const pi = idx("price");
  const fi = idx("fee");
  const ai = idx("amount");
  const aci = idx("acq");
  const ci = idx("ccy");
  const cell = (c: string[], i: number) => (i >= 0 && i < c.length ? c[i].trim().replace(/^"|"$/g, "") : "");

  const out: Txn[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(delim);
    if (c.length < 2) continue;
    const rawType = cell(c, ti) || "Buy";
    const idRaw = cell(c, idi);
    out.push({
      id: idRaw || cell(c, di) + "|" + rawType + "|" + cell(c, isi) + "|" + cell(c, qi) + "|" + cell(c, ai) + "|" + i,
      date: cell(c, di),
      rawType,
      category: classify(rawType),
      name: cell(c, ni),
      ticker: cell(c, ki).toUpperCase(),
      isin: cell(c, isi).toUpperCase(),
      qty: parseNum(cell(c, qi)),
      price: parseNum(cell(c, pi)),
      fee: parseNum(cell(c, fi)),
      amount: parseNum(cell(c, ai)),
      acqValue: parseNum(cell(c, aci)),
      ccy: cell(c, ci) || "EUR",
    });
  }
  return out;
}

export interface PosRow {
  key: string;
  ticker: string;
  name: string;
  qtyStr: string;
  avgStr: string;
  investedStr: string;
}
export interface TxRow {
  i: number;
  date: string;
  type: string;
  typeCls: string;
  ticker: string;
  name: string;
  qtyStr: string;
  priceStr: string;
  amtStr: string;
}

export interface TxComputed {
  posRows: PosRow[];
  txRows: TxRow[];
  txCount: number;
  txInstruments: number;
  txPosCount: number;
  txNetDepositsStr: string;
  txDateRange: string;
  txHas: boolean;
  txEmpty: boolean;
}

const qtyFmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const money2 = (n: number) =>
  (n < 0 ? "−€" : "€") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function computeTx(txns: Txn[]): TxComputed {
  // Positions: walk chronologically, running average-cost basis per instrument.
  const asc = txns
    .map((t, i) => ({ t, i }))
    .sort((a, b) => (a.t.date < b.t.date ? -1 : a.t.date > b.t.date ? 1 : a.i - b.i))
    .map((x) => x.t);

  const pos: Record<string, { ticker: string; name: string; isin: string; qty: number; cost: number }> = {};
  const tradedKeys = new Set<string>();
  const keyOf = (t: Txn) => t.isin || t.ticker || t.name;

  asc.forEach((t) => {
    const sign = shareSign(t.category);
    if (sign === 0) return;
    const k = keyOf(t);
    if (!k) return;
    tradedKeys.add(k);
    if (!pos[k]) pos[k] = { ticker: t.ticker || t.isin, name: t.name || t.ticker || t.isin, isin: t.isin, qty: 0, cost: 0 };
    const p = pos[k];
    if (t.name && (!p.name || p.name === p.isin)) p.name = t.name;
    if (sign === 1) {
      const add = t.acqValue > 0 ? t.acqValue : t.qty * t.price + t.fee;
      p.qty += t.qty;
      p.cost += add;
    } else {
      if (p.qty > 1e-9) {
        const avg = p.cost / p.qty;
        p.cost = Math.max(0, p.cost - avg * t.qty);
      }
      p.qty -= t.qty;
    }
  });

  const positions = Object.values(pos)
    .filter((p) => p.qty > 1e-6)
    .sort((a, b) => b.cost - a.cost);

  const posRows: PosRow[] = positions.map((p) => ({
    key: p.isin || p.ticker || p.name,
    ticker: p.ticker || p.isin || "—",
    name: p.name,
    qtyStr: qtyFmt(p.qty),
    avgStr: p.qty ? "€" + (p.cost / p.qty).toFixed(2) : "—",
    investedStr: eur(p.cost),
  }));

  const txRows: TxRow[] = txns.map((t, i) => ({
    i,
    date: t.date || "—",
    type: TYPE_LABEL[t.category],
    typeCls: "txbadge " + TYPE_CLS[t.category],
    ticker: t.ticker || t.isin || "—",
    name: t.name || "—",
    qtyStr: t.qty ? qtyFmt(t.qty) : "—",
    priceStr: t.price ? t.price.toFixed(2) : "—",
    amtStr: t.amount ? money2(t.amount) : t.qty && t.price ? money2(t.qty * t.price) : "—",
  }));

  const dates = txns.map((t) => t.date).filter(Boolean).sort();
  // Net deposits = deposits − withdrawals (cash actually contributed to the account)
  const netDeposits = txns
    .filter((t) => t.category === "deposit" || t.category === "withdrawal")
    .reduce((s, t) => s + t.amount, 0);

  return {
    posRows,
    txRows,
    txCount: txns.length,
    txInstruments: tradedKeys.size,
    txPosCount: positions.length,
    txNetDepositsStr: eur(netDeposits),
    txDateRange: dates.length ? dates[0] + "  →  " + dates[dates.length - 1] : "—",
    txHas: txns.length > 0,
    txEmpty: txns.length === 0,
  };
}
