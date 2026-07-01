import { useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore";

const stCls: Record<string, string> = { Portfolio: "st-pf", Watchlist: "st-wl" };

// Companies tab (under Research): every current holding (Status "Portfolio")
// plus companies the user has added to follow (Status "Watchlist"). Each opens
// a company page where notes can be posted.
export default function CompaniesPanel() {
  const navigate = useNavigate();
  const watchlist = useStore((s) => s.watchlist);
  const notes = useStore((s) => s.notes);
  const holdingsGroups = useStore((s) => s.portfolio.holdingsGroups);
  const wlTicker = useStore((s) => s.wlTicker);
  const wlName = useStore((s) => s.wlName);
  const setWlTicker = useStore((s) => s.setWlTicker);
  const setWlName = useStore((s) => s.setWlName);
  const addWatch = useStore((s) => s.addWatch);
  const removeWatch = useStore((s) => s.removeWatch);

  const open = (ticker: string) => navigate(`/company/${encodeURIComponent(ticker)}`);

  // held companies (exclude the cash row), then followed watchlist names not held
  const held = holdingsGroups
    .flatMap((g) => g.rows)
    .filter((r) => r.ticker !== "CASH")
    .map((r) => ({ ticker: r.ticker, name: r.name, status: "Portfolio" as const }));
  const heldSet = new Set(held.map((h) => h.ticker));
  const followed = watchlist
    .filter((w) => !heldSet.has(w.ticker))
    .map((w) => ({ ticker: w.ticker, name: w.name || w.ticker, status: "Watchlist" as const }));
  const companies = [...held, ...followed];

  return (
    <>
      <div className="card wladd">
        <div className="cardttl">Follow a company</div>
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
        {companies.map((co) => {
          const list = notes[co.ticker] || [];
          const latest = list.length ? [...list].sort((a, b) => b.ts - a.ts)[0].text : "";
          const preview = list.length
            ? `${list.length} note${list.length > 1 ? "s" : ""} · ${latest.length > 70 ? latest.slice(0, 70) + "…" : latest}`
            : "No notes yet — open to add";
          return (
            <div className="wlrow" key={co.ticker}>
              <span className="wlco" onClick={() => open(co.ticker)}>
                <b className="num">{co.ticker}</b>
                <span className="wlconame">{co.name}</span>
              </span>
              <span className="c">
                <span className={"stbadge " + stCls[co.status]}>{co.status}</span>
              </span>
              <span className={"wlnote" + (list.length ? "" : " wlnoteempty")} onClick={() => open(co.ticker)}>
                {preview}
              </span>
              <span className="wlacts">
                <button className="wlopen" onClick={() => open(co.ticker)}>
                  Open
                </button>
                {co.status === "Watchlist" && (
                  <button className="wlrm" onClick={() => removeWatch(co.ticker)}>
                    Remove
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
