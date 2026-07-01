import { ACCENT, type TrendPeriod } from "../../data/portfolio";
import { useStore } from "../../store/useStore";
import LineChart from "../../charts/LineChart";

const PERIODS: TrendPeriod[] = ["1M", "3M", "6M", "YTD", "1Y", "3Y", "5Y", "Max"];
const GROUPS: { key: "stocks" | "funds" | "cash"; label: string }[] = [
  { key: "stocks", label: "Stocks" },
  { key: "funds", label: "Funds & ETFs" },
  { key: "cash", label: "Cash & equivalent" },
];

export default function PerformanceTab() {
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
    <>
      <div className="card perfcard">
        <div className="cardhd sm">
          <div>
            <span className="cardttl">Performance vs {perf.benchName}</span>
            <div className="modehint" style={{ marginTop: 4 }}>
              Time-weighted return (Nordnet convention — deposits &amp; withdrawals excluded), including instruments you
              have since sold. Change the benchmark with the selector above.
            </div>
          </div>
          <div className="periodrow">
            {PERIODS.map((p) => (
              <button key={p} className={"pbtn" + (period === p ? " on" : "")} onClick={() => setPeriod(p)}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="grptoggle" style={{ marginTop: 14 }}>
          <span className="grplbl">Include</span>
          <div className="toggle">
            {GROUPS.map((g) => (
              <button key={g.key} className={"tgl" + (perfGroups[g.key] ? " on" : "")} onClick={() => togglePerfGroup(g.key)}>
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div className="chartwrap" style={{ height: 320, marginTop: 16 }}>
          <LineChart
            a={perf.a}
            b={perf.b}
            accent={ACCENT}
            height={320}
            gradId="gPerfTab"
            benchName={perf.benchName}
            dates={perf.dates}
            hoverIdx={hoverPerf}
            onHover={setHoverPerf}
          />
        </div>

        <div className="perflegend" style={{ marginTop: 14 }}>
          <span className="lg lgp">
            Portfolio <b className={"num " + perf.perfPortCls}>&nbsp;{perf.perfPortStr}</b>
          </span>
          <span className="lg lgb">
            {perf.benchName} <b className={"num " + perf.perfBenchCls}>&nbsp;{perf.perfBenchStr}</b>
          </span>
        </div>
      </div>

      <div className="kstrip k4cal">
        {perf.perfStats.map((s) => (
          <div className="kc" key={s.k}>
            <div className="klbl">{s.k}</div>
            <div className={"knum num " + s.cls}>{s.v}</div>
          </div>
        ))}
      </div>
    </>
  );
}
