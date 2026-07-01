import { Outlet, useNavigate, useLocation } from "react-router-dom";
import IconChevronDown from "../../icons/chevronDown";
import { useStore } from "../../store/useStore";

const TABS = ["Overview", "Allocation", "Performance", "Holdings", "Dividends"];

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const bench = useStore((s) => s.bench);
  const setBench = useStore((s) => s.setBench);
  const kpis = useStore((s) => s.portfolio.kpis);
  const benchDefs = useStore((s) => s.portfolio.benchDefs);
  const pricesLoading = useStore((s) => s.pricesLoading);
  const pricesFetchedAt = useStore((s) => s.pricesFetchedAt);
  const current = pathname.split("/")[2] || "overview";

  const asof = pricesLoading
    ? "Updating live prices…"
    : pricesFetchedAt
      ? "Live prices · updated " + new Date(pricesFetchedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
      : "Prices from your transactions (fetching live…)";

  return (
    <>
      <div className="subhead">
        <div>
          <div className="ttl">My portfolio</div>
          <div className="asof">{asof}</div>
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
