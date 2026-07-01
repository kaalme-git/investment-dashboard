import { useNavigate, useParams } from "react-router-dom";
import { useStore } from "../store/useStore";
import { reportsForTicker, mapRes } from "../data/research";
import ResearchCard from "../components/ResearchCard";

const stCls: Record<string, string> = { Portfolio: "st-pf", Watchlist: "st-wl", Inactive: "st-in" };

export default function CompanyScreen() {
  const navigate = useNavigate();
  const { ticker = "" } = useParams();
  const watchlist = useStore((s) => s.watchlist);
  const notes = useStore((s) => s.notes);
  const setNote = useStore((s) => s.setNote);
  const addWatchTicker = useStore((s) => s.addWatchTicker);
  const companyMetrics = useStore((s) => s.portfolio.companyMetrics);
  const isHeld = useStore((s) => s.portfolio.isHeld);

  const metrics = companyMetrics(ticker);
  const held = isHeld(ticker);
  const wEntry = watchlist.find((w) => w.ticker === ticker);
  const status = held ? "Portfolio" : wEntry ? "Watchlist" : "Inactive";
  const name = metrics?.name || wEntry?.name || ticker;
  const reports = reportsForTicker(ticker).map(mapRes);

  return (
    <>
      <div className="subhead">
        <div className="cohd">
          <button className="cobackbtn" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div>
            <div className="cottl">
              <span className="coname">{name}</span>
              <span className="num cotick">{ticker}</span>
              <span className={"stbadge " + stCls[status]}>{status}</span>
            </div>
            <div className="asof">
              {metrics ? `${metrics.sector} · ${metrics.region}` : "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="body">
        {metrics && (
          <div className="cometrics">
            <Metric k="Last price" v={metrics.lastStr} />
            <Metric k="Market value" v={metrics.valueStr} />
            <Metric k="Day" v={metrics.dayStr} cls={metrics.dayCls} />
            <Metric k="Total return" v={metrics.totalStr} cls={metrics.totCls} />
            <Metric k="Weight" v={metrics.weightStr} />
            <Metric k="Shares" v={metrics.sharesStr} />
            <Metric k="Avg cost" v={metrics.avgStr} />
            <Metric k="Div. yield" v={metrics.yieldStr} />
            <div className="cm">
              <div className="cmk">Inderes rec.</div>
              <div className="cmv">
                <span className={"rec " + metrics.recCls}>{metrics.recShort}</span>
              </div>
            </div>
          </div>
        )}

        {status === "Watchlist" && !metrics && (
          <div className="card conote-empty">
            On your <b>watchlist</b> — not held yet, so live market data isn't shown. Add it via a transaction to populate
            metrics.
          </div>
        )}

        {status === "Inactive" && (
          <div className="card conote-empty">
            This company is <b>inactive</b> — not currently in your portfolio or watchlist. Your notes are kept.{" "}
            <button className="wlopen" onClick={() => addWatchTicker(ticker, name)}>
              Add to watchlist
            </button>
          </div>
        )}

        {reports.length > 0 && (
          <div className="cores">
            <div className="coresttl">Inderes research</div>
            <div className="reslist">
              {reports.map((r) => (
                <ResearchCard key={r.id} r={r} onClick={() => navigate(`/report/${r.id}`)} />
              ))}
            </div>
          </div>
        )}

        <div className="card conotes">
          <div className="cardttl">My notes</div>
          <textarea
            className="stratin conotesin"
            rows={8}
            placeholder="Why you're interested, valuation thoughts, what to watch for…"
            value={notes[ticker] || ""}
            onChange={(e) => setNote(ticker, e.target.value)}
          />
          <div className="modehint">
            Saved locally and tied to {ticker} — they persist when you re-import transactions or refresh the portfolio.
          </div>
        </div>
      </div>
    </>
  );
}

function Metric({ k, v, cls = "" }: { k: string; v: string; cls?: string }) {
  return (
    <div className="cm">
      <div className="cmk">{k}</div>
      <div className={"cmv num " + cls}>{v}</div>
    </div>
  );
}
