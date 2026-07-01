import type { ResDisplay } from "../data/research";

/** A single Inderes research card — shared by the Research feed and the
 *  Company page's research list. */
export default function ResearchCard({ r, onClick }: { r: ResDisplay; onClick?: () => void }) {
  return (
    <div className={"rescard" + (onClick ? " reslink" : "")} onClick={onClick}>
      <span className={r.kindCls}>{r.kind}</span>
      <div className="resmain">
        <div className="restitle">{r.title}</div>
        <div className="ressub">
          {r.sub} · {r.date}
        </div>
      </div>
      <div className="resright">
        <span className={"resprem" + (r.premium ? "" : " reshide")}>PREMIUM</span>
        {r.hasRec && <span className={"rec " + r.recCls}>{r.recShort}</span>}
        <span className="ressite">inderes</span>
      </div>
    </div>
  );
}
