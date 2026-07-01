import { ACCENT, type TrendPeriod } from "../../../data/portfolio";
import { useStore } from "../../../store/useStore";
import LineChart from "../../../charts/LineChart";

const PERIODS: TrendPeriod[] = ["1M", "3M", "6M", "YTD", "1Y", "3Y", "5Y", "Max"];
const GROUPS: { key: "stocks" | "funds" | "cash"; label: string }[] = [
  { key: "stocks", label: "Stocks" },
  { key: "funds", label: "Funds" },
  { key: "cash", label: "Cash & eq." },
];

export default function ValueChartCard() {
  const bench = useStore((s) => s.bench);
  const period = useStore((s) => s.period);
  const setPeriod = useStore((s) => s.setPeriod);
  const hoverPerf = useStore((s) => s.hoverPerf);
  const setHoverPerf = useStore((s) => s.setHoverPerf);
  const perfGroups = useStore((s) => s.perfGroups);
  const togglePerfGroup = useStore((s) => s.togglePerfGroup);
  const getPerformance = useStore((s) => s.portfolio.getPerformance);

  const perf = getPerformance(bench, period, perfGroups);

  return (
    <div className="card">
      <div className="cardhd sm">
        <span className="cardttl sm">Value vs {perf.benchName}</span>
        <div className="periodrow">
          {PERIODS.map((p) => (
            <button key={p} className={"pbtn" + (period === p ? " on" : "")} onClick={() => setPeriod(p)}>
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grptoggle">
        <span className="grplbl">Include</span>
        <div className="toggle">
          {GROUPS.map((g) => (
            <button key={g.key} className={"tgl" + (perfGroups[g.key] ? " on" : "")} onClick={() => togglePerfGroup(g.key)}>
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chartwrap sm">
        <LineChart
          a={perf.a}
          b={perf.b}
          accent={ACCENT}
          height={188}
          gradId="gPerf"
          benchName="Index"
          dates={perf.dates}
          fill
          hoverIdx={hoverPerf}
          onHover={setHoverPerf}
        />
      </div>

      <div className="perflegend">
        <span className="lg lgp">
          Portfolio <b className={"num " + perf.perfPortCls}>&nbsp;{perf.perfPortStr}</b>
        </span>
        <span className="lg lgb">
          {perf.benchName} <b className={"num " + perf.perfBenchCls}>&nbsp;{perf.perfBenchStr}</b>
        </span>
      </div>
      <div className="pstats">
        {perf.perfStats.map((s) => (
          <div className="pstat" key={s.k}>
            <div className="pstk">{s.k}</div>
            <div className={"pstv num " + s.cls}>{s.v}</div>
          </div>
        ))}
      </div>
      <div className="modehint" style={{ marginTop: 8 }}>
        Time-weighted return (Nordnet convention — deposits/withdrawals excluded) across your {" "}
        {[perfGroups.stocks && "stocks", perfGroups.funds && "funds", perfGroups.cash && "cash"].filter(Boolean).join(" + ") || "—"}, including instruments since sold. See the Performance tab for detail.
      </div>
    </div>
  );
}
