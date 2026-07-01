import { useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore";
import { researchByTab, mapRes, type ResTab } from "../data/research";
import ResearchCard from "../components/ResearchCard";

const TABS: { k: ResTab; label: string }[] = [
  { k: "equity", label: "Equity research" },
  { k: "market", label: "Market research" },
  { k: "macro", label: "Macro research" },
];

export default function ResearchScreen() {
  const navigate = useNavigate();
  const resTab = useStore((s) => s.resTab);
  const setResTab = useStore((s) => s.setResTab);
  const items = researchByTab(resTab).map(mapRes);

  return (
    <>
      <div className="subhead">
        <div>
          <div className="ttl">Research</div>
          <div className="asof">
            Reports & news for your portfolio and watchlist — sourced via the Inderes connector (MCP)
          </div>
        </div>
        <div className="ressrc">
          <span className="resdot" />
          inderes · connected
        </div>
      </div>
      <div className="tabsrow">
        {TABS.map((t) => (
          <button key={t.k} className={"tab" + (resTab === t.k ? " on" : "")} onClick={() => setResTab(t.k)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="body">
        <div className="reslist">
          {items.map((r) => (
            <ResearchCard key={r.id} r={r} onClick={() => navigate(`/report/${r.id}`)} />
          ))}
        </div>
      </div>
    </>
  );
}
