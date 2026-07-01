import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore";
import { researchByTab, mapRes, type ResTab } from "../data/research";
import ResearchCard from "../components/ResearchCard";
import CompaniesPanel from "../components/CompaniesPanel";

const TABS: { k: ResTab; label: string }[] = [
  { k: "equity", label: "Equity research" },
  { k: "market", label: "Market research" },
  { k: "macro", label: "Macro research" },
];

export default function ResearchScreen() {
  const navigate = useNavigate();
  const resTab = useStore((s) => s.resTab);
  const setResTab = useStore((s) => s.setResTab);
  const watchlist = useStore((s) => s.watchlist);
  const [showWatchlist, setShowWatchlist] = useState(false);
  const items = researchByTab(resTab).map(mapRes);

  return (
    <>
      <div className="subhead">
        <div>
          <div className="ttl">Research</div>
          <div className="asof">
            {showWatchlist
              ? `Companies you're considering — ${watchlist.length} tracked. Notes are saved and survive portfolio updates.`
              : "Reports & news for your portfolio and watchlist — sourced via the Inderes connector (MCP)"}
          </div>
        </div>
        <div className="ressrc">
          <span className="resdot" />
          inderes · connected
        </div>
      </div>
      <div className="tabsrow">
        {TABS.map((t) => (
          <button
            key={t.k}
            className={"tab" + (!showWatchlist && resTab === t.k ? " on" : "")}
            onClick={() => { setResTab(t.k); setShowWatchlist(false); }}
          >
            {t.label}
          </button>
        ))}
        <button className={"tab" + (showWatchlist ? " on" : "")} onClick={() => setShowWatchlist(true)}>
          Companies
        </button>
      </div>
      <div className="body">
        {showWatchlist ? (
          <CompaniesPanel />
        ) : (
          <div className="reslist">
            {items.map((r) => (
              <ResearchCard key={r.id} r={r} onClick={() => navigate(`/report/${r.id}`)} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
