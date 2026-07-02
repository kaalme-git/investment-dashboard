import { useStore } from "../store/useStore";
import Donut from "../charts/Donut";

/** Donut + center readout + weighted legend, driven by the shared allocMode /
 *  hoverAlloc store state. Used on both Overview and the Allocation tab.
 *  `selectable` (Allocation tab only) lets a slice/row be clicked to open its
 *  drill-down; Overview leaves it off. */
export default function AllocDonutLegend({ selectable = false }: { selectable?: boolean }) {
  const allocMode = useStore((s) => s.allocMode);
  const hoverAlloc = useStore((s) => s.hoverAlloc);
  const setHoverAlloc = useStore((s) => s.setHoverAlloc);
  const allocSelected = useStore((s) => s.allocSelected);
  const setAllocSelected = useStore((s) => s.setAllocSelected);
  const allocMap = useStore((s) => s.portfolio.allocMap);

  const list = allocMap[allocMode];
  const sel = selectable ? allocSelected : null;
  const active = hoverAlloc ?? sel; // what the center readout shows
  const ctr = (active != null ? list[active] : list[0]) || { label: "—", pctStr: "—" };
  const onSelect = selectable ? setAllocSelected : undefined;

  return (
    <>
      <div className="donutwrap">
        <Donut segs={list} hoverIdx={hoverAlloc} selectedIdx={sel} onEnter={setHoverAlloc} onLeave={() => setHoverAlloc(null)} onSelect={onSelect} />
        <div className="donutmid">
          <div className="dmlbl">{ctr.label}</div>
          <div className="dmval num">{ctr.pctStr}</div>
        </div>
      </div>
      <div className="leg">
        {list.map((s, i) => {
          const dim = (hoverAlloc ?? sel) != null && (hoverAlloc ?? sel) !== i;
          return (
            <div
              key={s.label}
              className={"legrow alrow" + (sel === i ? " on" : "")}
              style={{ opacity: dim ? 0.4 : 1, cursor: "pointer", transition: "opacity .16s ease" }}
              onMouseEnter={() => setHoverAlloc(i)}
              onMouseLeave={() => setHoverAlloc(null)}
              onClick={onSelect ? () => onSelect(i) : undefined}
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
