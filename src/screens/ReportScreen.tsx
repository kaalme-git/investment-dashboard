import { useNavigate, useParams } from "react-router-dom";
import { findReport, mapRes } from "../data/research";

export default function ReportScreen() {
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const item = findReport(id);

  if (!item) {
    return (
      <>
        <div className="subhead">
          <div className="cohd">
            <button className="cobackbtn" onClick={() => navigate(-1)}>
              ← Back
            </button>
          </div>
        </div>
        <div className="body">
          <div className="card phcard">
            <div className="emptyhint">Report not found.</div>
          </div>
        </div>
      </>
    );
  }

  const d = mapRes(item);

  return (
    <>
      <div className="subhead">
        <div className="cohd">
          <button className="cobackbtn" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div>
            <div className="cottl">
              <span className={d.kindCls}>{d.kind}</span>
              <span className={"resprem" + (d.premium ? "" : " reshide")}>PREMIUM</span>
              {d.hasRec && <span className={"rec " + d.recCls}>{d.recShort}</span>}
            </div>
            <div className="reptitle">{d.title}</div>
            <div className="asof">
              {d.sub} · {d.date} · inderes
            </div>
          </div>
        </div>
      </div>
      <div className="body">
        <div className="card reptext">
          <p className="repp">
            This Inderes note reviews the key drivers, estimate changes and valuation behind “{d.title}”.
          </p>
          <p className="repp">
            Highlights: demand and order trends, margin outlook, balance-sheet strength, and the risk/reward versus the
            current share price. Our recommendation reflects these points.
          </p>
          <p className="repp">See the full note for detailed estimates, scenario analysis and the target-price bridge.</p>
          {item.ticker && (
            <button className="wlopen" onClick={() => navigate(`/company/${encodeURIComponent(item.ticker!)}`)}>
              Open {item.company} page →
            </button>
          )}
          <div className="modehint">Demo abstract — with the Inderes connector live, the full report and PDF load here.</div>
        </div>
      </div>
    </>
  );
}
