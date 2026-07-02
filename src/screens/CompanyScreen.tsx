import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStore } from "../store/useStore";
import { reportsForTicker, mapRes } from "../data/research";
import ResearchCard from "../components/ResearchCard";

const stCls: Record<string, string> = { Portfolio: "st-pf", Watchlist: "st-wl", Inactive: "st-in" };
const fmtTs = (ts: number) =>
  ts ? new Date(ts).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "earlier";

export default function CompanyScreen() {
  const navigate = useNavigate();
  const { ticker = "" } = useParams();
  const watchlist = useStore((s) => s.watchlist);
  const notes = useStore((s) => s.notes);
  const addNote = useStore((s) => s.addNote);
  const removeNote = useStore((s) => s.removeNote);
  const addWatchTicker = useStore((s) => s.addWatchTicker);
  const companyMetrics = useStore((s) => s.portfolio.companyMetrics);
  const isHeld = useStore((s) => s.portfolio.isHeld);
  const setStyleOverride = useStore((s) => s.setStyleOverride);
  const [draft, setDraft] = useState("");

  const metrics = companyMetrics(ticker);
  const held = isHeld(ticker);
  const wEntry = watchlist.find((w) => w.ticker === ticker);
  const status = held ? "Portfolio" : wEntry ? "Watchlist" : "Inactive";
  const name = metrics?.name || wEntry?.name || ticker;
  const reports = reportsForTicker(ticker).map(mapRes);
  const companyNotes = [...(notes[ticker] || [])].sort((a, b) => b.ts - a.ts);

  const post = () => {
    if (!draft.trim()) return;
    addNote(ticker, draft);
    setDraft("");
  };

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
            <Metric k="Inderes target" v={metrics.targetStr} />
            <div className="cm">
              <div className="cmk">Inderes rec.</div>
              <div className="cmv">
                <span className={"rec " + metrics.recCls}>{metrics.recShort}</span>
              </div>
            </div>
          </div>
        )}

        {metrics && (
          <div className="card clscard">
            <div className="cardttl">Classification</div>
            <div className="clsbuckets">
              <ClsBucket k="Sector" v={metrics.bucketSector} />
              <ClsBucket k="Region" v={metrics.bucketRegion} />
              <ClsBucket k="Asset" v={metrics.bucketAsset} />
              <ClsBucket k="Style" v={metrics.bucketStyle} />
            </div>

            {metrics.bucketStyle !== "Cash & equivalents" && metrics.isin && (
              <div className="clsovr">
                <span className="clssub" style={{ margin: 0 }}>Classify as</span>
                <div className="periodrow">
                  <button
                    className={"pbtn" + (metrics.bucketStyle === "Active" ? " on" : "")}
                    onClick={() => setStyleOverride(metrics.isin, "active")}
                  >
                    Active
                  </button>
                  <button
                    className={"pbtn" + (metrics.bucketStyle === "Passive" ? " on" : "")}
                    onClick={() => setStyleOverride(metrics.isin, "passive")}
                  >
                    Passive
                  </button>
                </div>
                {metrics.styleOverridden && (
                  <span className="clsovrnote">
                    Overridden · auto is {metrics.styleAuto}
                    <button className="clsreset" onClick={() => setStyleOverride(metrics.isin, null)}>reset</button>
                  </span>
                )}
              </div>
            )}
            {metrics.fundSectors && (
              <div className="clssectors">
                <div className="clssub">Sector look-through (fund holdings)</div>
                <div className="clssrows">
                  {metrics.fundSectors.map((s) => (
                    <div className="clssrow" key={s.label}>
                      <span className="clsslbl">{s.label}</span>
                      <div className="clsstrack">
                        <div className="clssfill" style={{ width: s.pctStr }} />
                      </div>
                      <span className="num clsspct">{s.pctStr}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="clssub">How it's derived</div>
            <div className="clsvars">
              {metrics.clsVars.map((r) => (
                <div className="clsvar" key={r.k}>
                  <span className="clsvk">{r.k}</span>
                  <span className="clsvv">{r.v}</span>
                </div>
              ))}
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
          <div className="cardttl">Notes</div>
          <div className="noteform">
            <textarea
              className="stratin notein"
              rows={3}
              placeholder="Add a note — valuation thoughts, what to watch for, a decision you made…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") post(); }}
            />
            <div className="noteformfoot">
              <span className="modehint">Saved to your account and tied to {ticker}.</span>
              <button className="askbtn" onClick={post} disabled={!draft.trim()}>Post note</button>
            </div>
          </div>

          {companyNotes.length === 0 ? (
            <div className="emptyhint" style={{ padding: "14px 2px 4px" }}>No notes yet — post your first above.</div>
          ) : (
            <div className="notelist">
              {companyNotes.map((n) => (
                <div className="noteitem" key={n.id}>
                  <div className="notemeta">
                    <span className="notets">{fmtTs(n.ts)}</span>
                    <button className="notedel" onClick={() => removeNote(ticker, n.id)} title="Delete note">Delete</button>
                  </div>
                  <div className="notetext">{n.text}</div>
                </div>
              ))}
            </div>
          )}
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

function ClsBucket({ k, v }: { k: string; v: string }) {
  return (
    <div className="clsb">
      <div className="clsbk">{k}</div>
      <div className="clsbv">{v}</div>
    </div>
  );
}
