import { useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore";

const stCls: Record<string, string> = { Portfolio: "st-pf", Watchlist: "st-wl", Inactive: "st-in" };

/** Watchlist body (add form + list). Rendered as a tab within the Research page. */
export default function WatchlistPanel() {
  const navigate = useNavigate();
  const watchlist = useStore((s) => s.watchlist);
  const notes = useStore((s) => s.notes);
  const isHeld = useStore((s) => s.portfolio.isHeld);
  const wlTicker = useStore((s) => s.wlTicker);
  const wlName = useStore((s) => s.wlName);
  const setWlTicker = useStore((s) => s.setWlTicker);
  const setWlName = useStore((s) => s.setWlName);
  const addWatch = useStore((s) => s.addWatch);
  const removeWatch = useStore((s) => s.removeWatch);

  const open = (ticker: string) => navigate(`/company/${encodeURIComponent(ticker)}`);

  return (
    <>
      <div className="card wladd">
        <div className="cardttl">Add a company</div>
        <div className="wladdrow">
          <input className="wlin" placeholder="Ticker (e.g. EVO)" value={wlTicker} onChange={(e) => setWlTicker(e.target.value)} />
          <input className="wlin wlinname" placeholder="Company name (optional)" value={wlName} onChange={(e) => setWlName(e.target.value)} />
          <button className="askbtn" onClick={addWatch}>
            Add to watchlist
          </button>
        </div>
      </div>

      <div className="card wllist">
        <div className="wlhead">
          <span>Company</span>
          <span className="c">Status</span>
          <span>Notes</span>
          <span />
        </div>
        {watchlist.map((w) => {
          const status = isHeld(w.ticker) ? "Portfolio" : "Watchlist";
          const nt = (notes[w.ticker] || "").trim();
          const notePrev = nt ? (nt.length > 96 ? nt.slice(0, 96) + "…" : nt) : "No notes yet — open to add";
          return (
            <div className="wlrow" key={w.ticker}>
              <span className="wlco" onClick={() => open(w.ticker)}>
                <b className="num">{w.ticker}</b>
                <span className="wlconame">{w.name || w.ticker}</span>
              </span>
              <span className="c">
                <span className={"stbadge " + stCls[status]}>{status}</span>
              </span>
              <span className={"wlnote" + (nt ? "" : " wlnoteempty")} onClick={() => open(w.ticker)}>
                {notePrev}
              </span>
              <span className="wlacts">
                <button className="wlopen" onClick={() => open(w.ticker)}>
                  Open
                </button>
                <button className="wlrm" onClick={() => removeWatch(w.ticker)}>
                  Remove
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
