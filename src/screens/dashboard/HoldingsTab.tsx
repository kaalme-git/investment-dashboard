import { useNavigate } from "react-router-dom";
import { useStore } from "../../store/useStore";
import InfoTip from "../../components/InfoTip";

export default function HoldingsTab() {
  const navigate = useNavigate();
  const holdingsGroups = useStore((s) => s.portfolio.holdingsGroups);
  return (
    <>
      <div className="card hdtable">
        <div className="hdhead">
          <span>Holding</span>
          <span className="c">Type</span>
          <span>Sector</span>
          <span className="r">Shares</span>
          <span className="r">Avg cost</span>
          <span className="r">Last</span>
          <span className="r">Mkt value</span>
          <span className="r">Day</span>
          <span className="r">Tot. ret.</span>
          <span className="r">
            Yield
            <InfoTip label="How Yield is calculated">
              Forward dividend yield — next year's Inderes analyst dividend estimate ÷ current share price. If Inderes
              doesn't cover the holding, it falls back to Yahoo Finance's trailing 12-month yield, and finally to the
              trailing dividends from your own transactions.
            </InfoTip>
          </span>
          <span className="r">Weight</span>
          <span className="c">
            Rec.
            <InfoTip label="About recommendations">
              Recommendations reflect current Inderes analyst ratings (Buy / Accumulate / Reduce / Sell), shown only for
              companies under Inderes coverage.
            </InfoTip>
          </span>
        </div>
        {holdingsGroups.map((g) => (
          <div key={g.key}>
            <div className="hdgroup">
              <span className="dgname">{g.label}</span>
              <span className="num dgv2">{g.valueStr}</span>
              <span className="num dgw2">{g.pctStr}</span>
            </div>
            {g.rows.map((h) => (
              <div
                className="hdrow hdclick"
                key={h.ticker}
                onClick={() => navigate(`/company/${encodeURIComponent(h.ticker)}`)}
              >
                <span className="hdname">
                  <b className="num">{h.ticker}</b>
                  <span className="hdsub">{h.name}</span>
                </span>
                <span className="c">
                  <span className={h.typeCls}>{h.typeLbl}</span>
                </span>
                <span className="dsec">{h.sector}</span>
                <span className="num r">{h.sharesStr}</span>
                <span className="num r">{h.avgStr}</span>
                <span className="num r">{h.lastStr}</span>
                <span className="num r">{h.valueStr}</span>
                <span className={"num r " + h.dayCls}>{h.dayStr}</span>
                <span className={"num r " + h.totCls}>{h.totalStr}</span>
                <span className="num r">{h.yieldStr}</span>
                <span className="num r">{h.weightStr}</span>
                <span className="c">
                  <span className={"rec " + h.recCls}>{h.recShort}</span>
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="srcnote">
        Positions are built from your imported transactions (Transactions tab). Market prices, day change and total
        return come from the connected market-data source.
      </div>
    </>
  );
}
