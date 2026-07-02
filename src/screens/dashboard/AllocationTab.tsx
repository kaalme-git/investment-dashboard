import { useNavigate } from "react-router-dom";
import { useStore } from "../../store/useStore";
import AllocToggle from "../../components/AllocToggle";
import AllocDonutLegend from "../../components/AllocDonutLegend";
import StackedArea from "../../charts/StackedArea";
import type { AllocSeg } from "../../data/types";

const fmtMonth = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "";

export default function AllocationTab() {
  const navigate = useNavigate();
  const allocMode = useStore((s) => s.allocMode);
  const allocSelected = useStore((s) => s.allocSelected);
  const allocMap = useStore((s) => s.portfolio.allocMap);
  const allocModeLbl = useStore((s) => s.portfolio.allocModeLbl);
  const allocDetail = useStore((s) => s.portfolio.allocDetail);
  const allocSeries = useStore((s) => s.portfolio.allocSeries);
  const allocDates = useStore((s) => s.portfolio.allocDates);

  const list = allocMap[allocMode];
  const nPts = allocDates.length;

  // over-time: each current band's real weight history; anything held historically
  // but not in today's bands rolls into a grey "Other" band so the stack sums to 100%.
  const dimSeries = allocSeries[allocMode] || {};
  const bandSeries = list.map((seg) => dimSeries[seg.label] || new Array(nPts).fill(0));
  const other = Array.from({ length: nPts }, (_, t) =>
    Math.max(0, 100 - list.reduce((s, _seg, i) => s + (bandSeries[i][t] ?? 0), 0)),
  );
  const hasOther = other.some((v) => v > 0.5);
  const areaSegs: AllocSeg[] = hasOther ? [...list, { label: "Other", pctNum: 0, color: "#757575", pctStr: "" }] : list;
  const areaSeries = hasOther ? [...bandSeries, other] : bandSeries;

  // drill-down: the instruments behind the clicked bucket
  const selBucket = allocSelected != null ? list[allocSelected] : null;
  const contribs = selBucket ? allocDetail[allocMode][selBucket.label] || [] : [];

  return (
    <>
      <div className="alloctabhd">
        <div className="cardttl">Allocation</div>
        <AllocToggle />
      </div>

      <div className="row2b">
        <div className="card alloccard">
          <div className="cardttl sm">Current allocation</div>
          <AllocDonutLegend selectable />
        </div>

        <div className="card alloccard">
          <div className="cardttl sm">In this bucket</div>
          {selBucket ? (
            <>
              <div className="bkhd">
                <span className="legdot" style={{ background: selBucket.color }} />
                <span className="bklbl">{selBucket.label}</span>
                <span className="bkpct num">{selBucket.pctStr}</span>
              </div>
              <div className="bklist">
                {contribs.map((c) => {
                  const clickable = c.ticker !== "CASH";
                  return (
                    <div
                      className={"bkrow" + (clickable ? " bkclick" : "")}
                      key={c.ticker + c.name + (c.note ?? "")}
                      onClick={clickable ? () => navigate(`/company/${encodeURIComponent(c.ticker)}`) : undefined}
                    >
                      <span className="num bktick">{c.ticker}</span>
                      <span className="bkname">
                        {c.name}
                        {c.note && <span className="bknote"> · {c.note}</span>}
                      </span>
                      <span className="num bkval">{c.valueStr}</span>
                      <span className="num bkw">{c.pctStr}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="emptyhint" style={{ padding: "24px 2px" }}>
              Click a slice or legend row to see the instruments behind it.
            </div>
          )}
        </div>
      </div>

      <div className="card alloctime">
        <div className="cardhd sm">
          <span className="cardttl sm">Allocation over time</span>
          <span className="sacap">Hover a band to see the bucket and its share</span>
        </div>
        <div className="satimewrap">
          <StackedArea segs={areaSegs} series={areaSeries} dates={allocDates} />
        </div>
        <div className="saxis">
          <span>{fmtMonth(allocDates[0])}</span>
          <span>today</span>
        </div>
        <div className="modehint">
          100% stacked — how your {allocModeLbl[allocMode]} mix has actually shifted, reconstructed from your
          transactions and prices.
        </div>
      </div>
    </>
  );
}
