import { useNavigate } from "react-router-dom";
import { useStore } from "../../../store/useStore";
import Sparkline from "../../../charts/Sparkline";

export default function OverviewTable() {
  const navigate = useNavigate();
  const tableGroups = useStore((s) => s.portfolio.tableGroups);
  return (
    <div className="card dtablecard t10">
      <div className="dthead">
        <span>Ticker</span>
        <span>Name</span>
        <span className="c">Type</span>
        <span>Sector</span>
        <span className="r">Last</span>
        <span className="c">3-mo</span>
        <span className="r">Weight</span>
        <span className="r">Value</span>
        <span className="r">Tot. ret.</span>
        <span className="c">Rec.</span>
      </div>
      {tableGroups.map((g) => (
        <div key={g.key}>
          <div className="dtgroup">
            <span className="dgname">{g.label}</span>
            <span className="num dgw">{g.pctStr}</span>
            <span className="num dgv">{g.valueStr}</span>
          </div>
          {g.rows.map((h) => {
            const clickable = h.ticker !== "CASH";
            return (
            <div
              className={"dtrow" + (clickable ? " dtclick" : "")}
              key={h.ticker}
              onClick={clickable ? () => navigate(`/company/${encodeURIComponent(h.ticker)}`) : undefined}
            >
              <span className="num dtick">{h.ticker}</span>
              <span className="dname">{h.name}</span>
              <span className="c">
                <span className={h.typeCls}>{h.typeLbl}</span>
              </span>
              <span className="dsec">{h.sector}</span>
              <span className="num r">{h.lastStr}</span>
              <span className="c dsp">{h.sparkData && <Sparkline data={h.sparkData} up={h.sparkUp} />}</span>
              <span className="num r">{h.weightStr}</span>
              <span className="num r">{h.valueStr}</span>
              <span className={"num r " + h.totCls}>{h.totalStr}</span>
              <span className="c">
                <span className={"rec " + h.recCls}>{h.recShort}</span>
              </span>
            </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
