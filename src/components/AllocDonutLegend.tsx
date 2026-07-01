import { useStore } from "../store/useStore";
import Donut from "../charts/Donut";

/** Donut + center readout + weighted legend, driven by the shared allocMode /
 *  hoverAlloc store state. Used on both Overview and the Allocation tab. */
export default function AllocDonutLegend() {
  const allocMode = useStore((s) => s.allocMode);
  const hoverAlloc = useStore((s) => s.hoverAlloc);
  const setHoverAlloc = useStore((s) => s.setHoverAlloc);
  const allocMap = useStore((s) => s.portfolio.allocMap);

  const list = allocMap[allocMode];
  const ctr = (hoverAlloc != null ? list[hoverAlloc] : list[0]) || { label: "—", pctStr: "—" };

  return (
    <>
      <div className="donutwrap">
        <Donut segs={list} hoverIdx={hoverAlloc} onEnter={setHoverAlloc} onLeave={() => setHoverAlloc(null)} />
        <div className="donutmid">
          <div className="dmlbl">{ctr.label}</div>
          <div className="dmval num">{ctr.pctStr}</div>
        </div>
      </div>
      <div className="leg">
        {list.map((s, i) => {
          const dim = hoverAlloc != null && hoverAlloc !== i;
          return (
            <div
              key={s.label}
              className="legrow alrow"
              style={{ opacity: dim ? 0.4 : 1, cursor: "pointer", transition: "opacity .16s ease" }}
              onMouseEnter={() => setHoverAlloc(i)}
              onMouseLeave={() => setHoverAlloc(null)}
            >
              <span className="legdot" style={{ background: s.color }} />
              <span className="leglbl">{s.label}</span>
              <div className="altrack">
                <div className="alfill" style={{ width: s.pctNum + "%", background: s.color }} />
              </div>
              <span className="legpct num">{s.pctStr}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
