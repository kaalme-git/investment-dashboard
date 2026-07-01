import { useStore } from "../../store/useStore";
import AllocToggle from "../../components/AllocToggle";
import AllocDonutLegend from "../../components/AllocDonutLegend";
import StackedArea from "../../charts/StackedArea";

export default function AllocationTab() {
  const allocMode = useStore((s) => s.allocMode);
  const hoverAlloc = useStore((s) => s.hoverAlloc);
  const setHoverAlloc = useStore((s) => s.setHoverAlloc);
  const allocMap = useStore((s) => s.portfolio.allocMap);
  const allocModeLbl = useStore((s) => s.portfolio.allocModeLbl);

  const list = allocMap[allocMode];
  const cap =
    hoverAlloc != null
      ? `${list[hoverAlloc].label} · ${list[hoverAlloc].pctStr} today`
      : "Hover a band to trace it over time";

  return (
    <>
      <div className="alloctabhd">
        <div className="cardttl">Allocation</div>
        <AllocToggle />
      </div>

      <div className="row2b">
        <div className="card alloccard">
          <div className="cardttl sm">Current allocation</div>
          <AllocDonutLegend />
        </div>

        <div className="card">
          <div className="cardhd sm">
            <span className="cardttl sm">Allocation over time</span>
            <span className="sacap">{cap}</span>
          </div>
          <div className="satimewrap">
            <StackedArea
              segs={list}
              n={13}
              hoverIdx={hoverAlloc}
              onEnter={setHoverAlloc}
              onLeave={() => setHoverAlloc(null)}
            />
          </div>
          <div className="saxis">
            <span>3 years ago</span>
            <span>today</span>
          </div>
          <div className="modehint">
            100% stacked — how your {allocModeLbl[allocMode]} mix has shifted over the last three years.
          </div>
        </div>
      </div>
    </>
  );
}
