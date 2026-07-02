import { Outlet, useNavigate, useLocation } from "react-router-dom";
import IconChevronDown from "../../icons/chevronDown";
import { useStore } from "../../store/useStore";

const TABS = ["Overview", "Allocation", "Performance", "Holdings", "Dividends", "Analysis"];

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const bench = useStore((s) => s.bench);
  const setBench = useStore((s) => s.setBench);
  const kpis = useStore((s) => s.portfolio.kpis);
  const benchDefs = useStore((s) => s.portfolio.benchDefs);
  const pricesLoading = useStore((s) => s.pricesLoading);
  const pricesFetchedAt = useStore((s) => s.pricesFetchedAt);
  const fetchPrices = useStore((s) => s.fetchPrices);
  const current = pathname.split("/")[2] || "overview";

  const asof = pricesLoading
    ? "Refreshing live prices…"
    : pricesFetchedAt
      ? "Live prices · updated " +
        new Date(pricesFetchedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
      : "Prices from your transactions — fetching live…";

  return (
    <>
      <div className="subhead">
        <div>
          <div className="ttl">My portfolio</div>
          <div className="asofrow">
            <span className="asof">{asof}</span>
            <button
              className={"refreshbtn" + (pricesLoading ? " spin" : "")}
              onClick={() => void fetchPrices(true)}
              disabled={pricesLoading}
              title="Refresh prices & recompute now"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Refresh</span>
            </button>
          </div>
        </div>
        <div className="benchwrap">
          <span className="benchlbl">vs</span>
          <div className="selwrap">
            <select className="sel" value={bench} onChange={(e) => setBench(e.target.value)}>
              {Object.keys(benchDefs).map((v) => (
                <option key={v} value={v}>
                  {benchDefs[v].label}
                </option>
              ))}
            </select>
            <IconChevronDown className="selcv" size="16" />
          </div>
        </div>
      </div>

      <div className="tabsrow">
        {TABS.map((t) => {
          const key = t.toLowerCase();
          return (
            <button
              key={t}
              className={"tab" + (current === key ? " on" : "")}
              onClick={() => navigate(`/dashboard/${key}`)}
            >
              {t}
            </button>
          );
        })}
      </div>

      <div className="body">
        <div className="kstrip">
          {kpis.map((k) => (
            <div className="kc" key={k.label}>
              <div className="klbl">{k.label}</div>
              <div className={"knum num " + k.cls}>{k.value}</div>
            </div>
          ))}
        </div>
        <Outlet />
      </div>
    </>
  );
}
