import { useEffect } from "react";
import { useStore } from "../store/useStore";
import { computeTx } from "../data/transactions";

export default function TransactionsScreen() {
  const txns = useStore((s) => s.txns);
  const txMode = useStore((s) => s.txMode);
  const txFile = useStore((s) => s.txFile);
  const setTxMode = useStore((s) => s.setTxMode);
  const importCsv = useStore((s) => s.importCsv);
  const loadSample = useStore((s) => s.loadSample);

  const c = computeTx(txns);

  // Optional ?sample flag → auto-load the demo data (handy for sharing a
  // populated preview link). Never fires once real transactions exist.
  useEffect(() => {
    if (txns.length === 0 && new URLSearchParams(window.location.search).has("sample")) loadSample();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function readFile(f: File) {
    // Decode by BOM — Nordnet exports are UTF-16 LE; the demo CSV is UTF-8.
    f.arrayBuffer()
      .then((buf) => {
        const b = new Uint8Array(buf);
        let enc = "utf-8";
        if (b[0] === 0xff && b[1] === 0xfe) enc = "utf-16le";
        else if (b[0] === 0xfe && b[1] === 0xff) enc = "utf-16be";
        const text = new TextDecoder(enc).decode(buf);
        importCsv(text, f.name);
      })
      .catch(() => {
        const rd = new FileReader();
        rd.onload = () => importCsv("" + rd.result, f.name);
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

  const modeHint =
    txMode === "refresh"
      ? "Rebuilds the whole portfolio from this file — replaces all existing transactions."
      : "Keeps your current history and appends only the rows in this file.";

  return (
    <>
      <div className="subhead">
        <div>
          <div className="ttl">Transactions</div>
          <div className="asof">Upload your full trade history (.csv) to build and update the portfolio</div>
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
            <div className="moderow">
              <span className="modelbl">On import</span>
              <div className="toggle">
                <button className={"tgl" + (txMode === "refresh" ? " on" : "")} onClick={() => setTxMode("refresh")}>
                  Refresh all
                </button>
                <button className={"tgl" + (txMode === "add" ? " on" : "")} onClick={() => setTxMode("add")}>
                  Add latest only
                </button>
              </div>
            </div>
            <div className="modehint">{modeHint}</div>
            <div className="uprow">
              <button className="sampbtn" onClick={loadSample}>
                Try with sample data
              </button>
            </div>
            <div className="fmt">
              Expected columns — <span className="mono">date, type, ticker, name, quantity, price, fee, currency</span>. Type
              accepts Buy / Sell / Dividend.
            </div>
          </div>

          <div className="card sumcard">
            <div className="cardttl">Import summary</div>
            {c.txEmpty ? (
              <div className="emptyhint">
                No transactions imported yet. Upload a CSV — or load the sample — and your positions, cost basis and
                allocations are built from it.
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
                  Positions & cost basis computed from your file. In the live product this rebuilds the full dashboard,
                  allocations and performance.
                </div>
              </>
            )}
          </div>
        </div>

        {c.txHas && (
          <>
            <div className="card postable">
              <div className="cardttl">Resulting positions</div>
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
              <div className="cardttl">Transaction history · {c.txCount}</div>
              <div className="txthead">
                <span>Date</span>
                <span>Type</span>
                <span>Ticker</span>
                <span>Name</span>
                <span className="r">Qty</span>
                <span className="r">Price</span>
                <span className="r">Amount</span>
              </div>
              {c.txRows.map((t) => (
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
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
