import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { computeTx, type TxCategory } from "../data/transactions";

export default function TransactionsScreen() {
  const txns = useStore((s) => s.txns);
  const txFile = useStore((s) => s.txFile);
  const importCsv = useStore((s) => s.importCsv);
  const pendingImport = useStore((s) => s.pendingImport);
  const resolveImport = useStore((s) => s.resolveImport);
  const clearAllTxns = useStore((s) => s.clearAllTxns);

  const c = computeTx(txns);

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
              Import your Nordnet transactions export (full or partial). New uploads are merged and deduplicated by
              transaction ID, so only genuinely new rows are added — no duplicates.
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
            <div className="cardttl">Import summary</div>
            {c.txEmpty ? (
              <div className="emptyhint">
                No transactions yet. Upload your Nordnet CSV and your positions, cost basis, allocations and performance
                are built from it.
              </div>
            ) : (
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
                    <div className="sumk">Net deposits</div>
                    <div className="sumv num">{c.txNetDepositsStr}</div>
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
              </div>
              {rows.length === 0 ? (
                <div className="emptyhint" style={{ padding: "18px 4px" }}>No transactions match these filters.</div>
              ) : (
                rows.map((t) => (
                  <div className="txtrow" key={t.i}>
                    <span className="num">{t.date}</span>
                    <span>
                      <span className={t.typeCls}>{t.type}</span>
                    </span>
                    <span className="num dtick">{t.ticker}</span>
                    <span className="dname">{t.name}</span>
                    <span className="num r">{t.qtyStr}</span>
                    <span className="num r">{t.priceStr}</span>
                    <span className="num r">{t.amtStr}</span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
