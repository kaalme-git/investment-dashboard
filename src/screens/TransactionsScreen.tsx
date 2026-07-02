import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { computeTx, type TxCategory } from "../data/transactions";
import { eur } from "../data/format";
import ProjectionChart from "../charts/ProjectionChart";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const isoLocal = (d: Date) =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

export default function TransactionsScreen() {
  const txns = useStore((s) => s.txns);
  const txFile = useStore((s) => s.txFile);
  const importCsv = useStore((s) => s.importCsv);
  const pendingImport = useStore((s) => s.pendingImport);
  const resolveImport = useStore((s) => s.resolveImport);
  const importResult = useStore((s) => s.importResult);
  const clearAllTxns = useStore((s) => s.clearAllTxns);
  const depositExclusions = useStore((s) => s.depositExclusions);
  const toggleDepositExclusion = useStore((s) => s.toggleDepositExclusion);

  const c = computeTx(txns);

  // ---- summary card: Summary vs Deposits view ----
  const [sumView, setSumView] = useState<"summary" | "deposits">("summary");
  const [depHover, setDepHover] = useState<number | null>(null);
  const exclCount = Object.keys(depositExclusions).length;
  // cumulative net deposits (deposits − withdrawals), sampled at each month end;
  // transactions the user marked as excluded (e.g. IPO subscription payments) are
  // skipped — DISPLAY ONLY, the return engine is untouched by this.
  const dep = useMemo(() => {
    const flows = txns
      .filter((t) => (t.category === "deposit" || t.category === "withdrawal") && t.date && !depositExclusions[t.id])
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    if (!flows.length) return null;
    const first = new Date(flows[0].date + "T00:00:00");
    const now = new Date();
    const values: number[] = [];
    const labels: string[] = [];
    let fi = 0;
    let cum = 0;
    for (let d = new Date(first.getFullYear(), first.getMonth(), 1); d <= now; d.setMonth(d.getMonth() + 1)) {
      const monthEnd = isoLocal(new Date(d.getFullYear(), d.getMonth() + 1, 0));
      while (fi < flows.length && flows[fi].date <= monthEnd) { cum += flows[fi].amount || 0; fi++; }
      values.push(Math.round(cum));
      labels.push(MONTH_ABBR[d.getMonth()] + " '" + String(d.getFullYear()).slice(2));
    }
    return { values, labels };
  }, [txns, depositExclusions]);

  // net-deposits figure honoring the exclusions (shown in Summary + chart caption)
  const netDepositsStr = useMemo(() => {
    const sum = txns
      .filter((t) => (t.category === "deposit" || t.category === "withdrawal") && !depositExclusions[t.id])
      .reduce((s, t) => s + (t.amount || 0), 0);
    return eur(sum);
  }, [txns, depositExclusions]);

  // ---- filters (default: whole history) ----
  // selTypes empty = all types; otherwise only the checked categories.
  const [selTypes, setSelTypes] = useState<Set<TxCategory>>(new Set());
  const [typeOpen, setTypeOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const typeRef = useRef<HTMLDivElement>(null);

  // transaction types actually present, for the dropdown (label per category)
  const types = useMemo(() => {
    const seen = new Map<TxCategory, string>();
    c.txRows.forEach((r) => { if (!seen.has(r.cat)) seen.set(r.cat, r.type); });
    return [...seen.entries()].map(([cat, label]) => ({ cat, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [c.txRows]);

  useEffect(() => {
    if (!typeOpen) return;
    const onDown = (e: MouseEvent) => { if (typeRef.current && !typeRef.current.contains(e.target as Node)) setTypeOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [typeOpen]);

  const toggleType = (cat: TxCategory) => {
    setSelTypes((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const rows = useMemo(() => {
    return c.txRows.filter((r) => {
      if (selTypes.size && !selTypes.has(r.cat)) return false;
      if (from && (r.date === "—" || r.date < from)) return false;
      if (to && (r.date === "—" || r.date > to)) return false;
      return true;
    });
  }, [c.txRows, selTypes, from, to]);

  const filtered = selTypes.size > 0 || !!from || !!to;
  const clearFilters = () => { setSelTypes(new Set()); setFrom(""); setTo(""); };
  const typeLabel = selTypes.size === 0 ? "All types" : selTypes.size + (selTypes.size === 1 ? " type" : " types");

  function readFile(f: File) {
    // Decode by BOM — Nordnet exports are UTF-16 LE.
    f.arrayBuffer()
      .then((buf) => {
        const b = new Uint8Array(buf);
        let enc = "utf-8";
        if (b[0] === 0xff && b[1] === 0xfe) enc = "utf-16le";
        else if (b[0] === 0xfe && b[1] === 0xff) enc = "utf-16be";
        void importCsv(new TextDecoder(enc).decode(buf), f.name);
      })
      .catch(() => {
        const rd = new FileReader();
        rd.onload = () => void importCsv("" + rd.result, f.name);
        rd.readAsText(f);
      });
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) readFile(f);
    e.target.value = "";
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f) readFile(f);
  }

  return (
    <>
      <div className="subhead">
        <div>
          <div className="ttl">Transactions</div>
          <div className="asof">Upload your full Nordnet trade history (.csv) to build and update the portfolio</div>
        </div>
      </div>
      <div className="body">
        <div className="txgrid">
          <div className="card upcard">
            <div className="cardttl">Import .csv</div>
            <label className={"dropzone" + (txns.length ? " has" : "")} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
              <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: "none" }} />
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <path d="M12 16V4M12 4L7.5 8.5M12 4l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <div className="dzttl">Drop your .csv here, or click to browse</div>
              <div className="dzsub">{txFile || "No file selected — accepts .csv"}</div>
            </label>
            {importResult && !pendingImport && (
              <div className={"importres " + (importResult.ok ? "ir-ok" : "ir-err")}>
                <div className="irttl">{importResult.ok ? "✓" : "✕"} {importResult.message}</div>
                <div className="irmsg">
                  {importResult.ok ? (
                    <>
                      <b className="num">{importResult.added}</b> new transaction{importResult.added === 1 ? "" : "s"} added
                      {(importResult.skipped ?? 0) > 0 && <> · <span className="num">{importResult.skipped}</span> already in your account (skipped)</>}
                      {" · "}<span className="num">{importResult.total}</span> total
                      {importResult.range && <> · file covers <span className="num">{importResult.range}</span></>}
                    </>
                  ) : (
                    importResult.fileName
                  )}
                </div>
              </div>
            )}
            {pendingImport && (
              <div className="importwarn">
                <div className="iwttl">Different portfolio?</div>
                <div className="iwmsg">{pendingImport.message}</div>
                <div className="iwacts">
                  <button className="iwbtn danger" onClick={() => void resolveImport("replace")}>Replace all history</button>
                  <button className="iwbtn" onClick={() => void resolveImport("merge")}>Merge anyway</button>
                  <button className="iwbtn ghost" onClick={() => void resolveImport("cancel")}>Cancel</button>
                </div>
              </div>
            )}
            <div className="fmt">
              <b>Important: export your FULL Nordnet history, across ALL your accounts</b> — set the date range to
              cover everything. Positions, cost basis, returns and dividends are rebuilt from the transactions; a
              partial history gives wrong numbers. Uploads are deduplicated, so re-uploading never
              creates{" "}duplicates.
            </div>
            {txns.length > 0 && (
              <button
                className="clearbtn"
                onClick={() => { if (window.confirm("Delete ALL transactions and start over? This cannot be undone.")) void clearAllTxns(); }}
              >
                Clear all transactions & start over
              </button>
            )}
          </div>

          <div className="card sumcard">
            <div className="cardhd sm">
              <span className="cardttl">{sumView === "summary" ? "Import summary" : "Net deposits"}</span>
              <div className="periodrow">
                <button className={"pbtn" + (sumView === "summary" ? " on" : "")} onClick={() => setSumView("summary")}>
                  Summary
                </button>
                <button className={"pbtn" + (sumView === "deposits" ? " on" : "")} onClick={() => setSumView("deposits")}>
                  Deposits
                </button>
              </div>
            </div>
            {c.txEmpty ? (
              <div className="emptyhint">
                No transactions yet. Upload your full Nordnet history — all accounts, from the very first transaction —
                and your positions, cost basis, allocations and performance are built from it.
              </div>
            ) : sumView === "summary" ? (
              <>
                <div className="sumgrid">
                  <div className="sumc">
                    <div className="sumk">Transactions</div>
                    <div className="sumv num">{c.txCount}</div>
                  </div>
                  <div className="sumc">
                    <div className="sumk">Instruments</div>
                    <div className="sumv num">{c.txInstruments}</div>
                  </div>
                  <div className="sumc">
                    <div className="sumk">Open positions</div>
                    <div className="sumv num">{c.txPosCount}</div>
                  </div>
                  <div className="sumc">
                    <div className="sumk">Net deposits{exclCount > 0 ? ` (${exclCount} excl.)` : ""}</div>
                    <div className="sumv num" title={exclCount > 0 ? `Excludes ${exclCount} transaction${exclCount === 1 ? "" : "s"} you marked (e.g. IPO subscription payments)` : undefined}>
                      {netDepositsStr}
                    </div>
                  </div>
                </div>
                <div className="sumrange">
                  <span className="sumk">Date range</span>
                  <span className="num">{c.txDateRange}</span>
                </div>
                <div className="sumok">
                  Positions & cost basis are computed from your file and drive the whole dashboard, allocations and
                  performance.
                </div>
              </>
            ) : dep && dep.values.length >= 2 ? (
              <>
                <div className="depwrap">
                  <ProjectionChart
                    exp={dep.values}
                    target={0}
                    baseYear={0}
                    labels={dep.labels}
                    height={228}
                    hoverIdx={depHover}
                    onHover={setDepHover}
                  />
                </div>
                <div className="modehint">
                  Cumulative deposits minus withdrawals by month — the capital you've actually put in
                  ({netDepositsStr} today{exclCount > 0 ? `, excluding ${exclCount} marked transaction${exclCount === 1 ? "" : "s"}` : ""}).
                  Mark e.g. IPO subscription payments as excluded in the transaction list below.
                </div>
              </>
            ) : (
              <div className="emptyhint">No deposit or withdrawal transactions to chart yet.</div>
            )}
          </div>
        </div>

        {c.txHas && (
          <>
            <div className="card postable">
              <div className="cardttl">Current positions</div>
              <div className="pthead">
                <span>Ticker</span>
                <span>Name</span>
                <span className="r">Shares</span>
                <span className="r">Avg cost</span>
                <span className="r">Invested</span>
              </div>
              {c.posRows.map((p) => (
                <div className="ptrow" key={p.key}>
                  <span className="num dtick">{p.ticker}</span>
                  <span className="dname">{p.name}</span>
                  <span className="num r">{p.qtyStr}</span>
                  <span className="num r">{p.avgStr}</span>
                  <span className="num r">{p.investedStr}</span>
                </div>
              ))}
            </div>

            <div className="card txtable">
              <div className="txthd">
                <div className="cardttl">
                  Transaction history · {rows.length}
                  {filtered && <span className="txfilteredof"> of {c.txCount}</span>}
                </div>
                <div className="txfilters">
                  <div className="txms" ref={typeRef}>
                    <button className="txsel" onClick={() => setTypeOpen((o) => !o)} aria-haspopup="true" aria-expanded={typeOpen}>
                      {typeLabel}
                    </button>
                    {typeOpen && (
                      <div className="txms-pop">
                        {types.map((t) => (
                          <label key={t.cat} className="txms-item">
                            <input type="checkbox" checked={selTypes.has(t.cat)} onChange={() => toggleType(t.cat)} />
                            <span>{t.label}</span>
                          </label>
                        ))}
                        {selTypes.size > 0 && (
                          <button className="txms-clear" onClick={() => setSelTypes(new Set())}>Clear types</button>
                        )}
                      </div>
                    )}
                  </div>
                  <input className="txdate" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} title="From date" />
                  <span className="txdash">–</span>
                  <input className="txdate" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} title="To date" />
                  {filtered && <button className="txclear" onClick={clearFilters}>Clear</button>}
                </div>
              </div>
              <div className="txthead">
                <span>Date</span>
                <span>Type</span>
                <span>Ticker</span>
                <span>Name</span>
                <span className="r">Qty</span>
                <span className="r">Price</span>
                <span className="r">Amount</span>
                <span />
              </div>
              {rows.length === 0 ? (
                <div className="emptyhint" style={{ padding: "18px 4px" }}>No transactions match these filters.</div>
              ) : (
                rows.map((t) => {
                  const excludable = t.cat === "deposit" || t.cat === "withdrawal";
                  const excluded = !!depositExclusions[t.id];
                  return (
                    <div className={"txtrow" + (excluded ? " txexcluded" : "")} key={t.i}>
                      <span className="num">{t.date}</span>
                      <span>
                        <span className={t.typeCls}>{t.type}</span>
                      </span>
                      <span className="num dtick">{t.ticker}</span>
                      <span className="dname">{t.name}</span>
                      <span className="num r">{t.qtyStr}</span>
                      <span className="num r">{t.priceStr}</span>
                      <span className="num r txamt">{t.amtStr}</span>
                      <span className="c">
                        {excludable && (
                          <button
                            className={"txexbtn" + (excluded ? " on" : "")}
                            onClick={() => toggleDepositExclusion(t.id)}
                            title={excluded
                              ? "Excluded from net deposits — click to include again"
                              : "Exclude from net deposits (e.g. an IPO subscription payment)"}
                          >
                            {excluded ? "↩" : "⊘"}
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
