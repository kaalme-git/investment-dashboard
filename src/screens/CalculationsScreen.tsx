import { useStore } from "../store/useStore";
import { eur } from "../data/format";
import { VALUE_MASK } from "../data/live";
import ProjectionChart from "../charts/ProjectionChart";
import IconChevronDown from "../icons/chevronDown";

const CALC_C = ["Equities", "Fixed income", "Other", "Cash & equivalent"];
const EDIT_LABELS = ["Equities", "Fixed income", "Other"];
const YEARS = [10, 30, 50];
const numv = (v: number | "") => (typeof v === "number" ? v : 0);

export default function CalculationsScreen() {
  const calcRet = useStore((s) => s.calcRet);
  const calcMonthly = useStore((s) => s.calcMonthly);
  const calcYears = useStore((s) => s.calcYears);
  const calcTarget = useStore((s) => s.calcTarget);
  const calcHover = useStore((s) => s.calcHover);
  const calcAllocMode = useStore((s) => s.calcAllocMode);
  const targets = useStore((s) => s.targets);
  const setCalcRet = useStore((s) => s.setCalcRet);
  const setCalcMonthly = useStore((s) => s.setCalcMonthly);
  const setCalcYears = useStore((s) => s.setCalcYears);
  const setCalcTarget = useStore((s) => s.setCalcTarget);
  const setCalcHover = useStore((s) => s.setCalcHover);
  const setCalcAllocMode = useStore((s) => s.setCalcAllocMode);
  const assetCurrent = useStore((s) => s.portfolio.assetCurrent);
  const totalValue = useStore((s) => s.portfolio.totalValue);
  const hideValues = useStore((s) => s.hideValues);

  // target-allocation weights (cash = remainder), matching the Strategy tab
  const editSum = EDIT_LABELS.reduce((s, l) => s + numv(targets[l]), 0);
  const cashTgt = Math.max(0, 100 - editSum);
  const effTgt = (l: string) => (l === "Cash & equivalent" ? cashTgt : numv(targets[l]));

  // The projection uses the SELECTED allocation for both the starting split and
  // where new money goes — so the blended return reflects that allocation.
  //  • "current"  → your allocation right now (assetCurrent)
  //  • "target"   → your target allocation (assumes you rebalance to it)
  const weightPct = (l: string) => (calcAllocMode === "target" ? effTgt(l) : assetCurrent[l] || 0);

  const startV: Record<string, number> = {};
  CALC_C.forEach((l) => (startV[l] = (weightPct(l) / 100) * totalValue));
  const cw: Record<string, number> = {};
  CALC_C.forEach((l) => (cw[l] = weightPct(l) / 100));

  const monthly = numv(calcMonthly);
  const years = calcYears;
  const months = years * 12;

  // monthly compounding per class, rolled up to yearly points
  const expPath: number[] = (() => {
    const v: Record<string, number> = {};
    CALC_C.forEach((l) => (v[l] = startV[l]));
    const pts = [CALC_C.reduce((a, l) => a + v[l], 0)];
    for (let m = 1; m <= months; m++) {
      CALC_C.forEach((l) => {
        const r = numv(calcRet[l]) / 100 / 12;
        v[l] = v[l] * (1 + r) + monthly * (cw[l] || 0);
      });
      if (m % 12 === 0) pts.push(CALC_C.reduce((a, l) => a + v[l], 0));
    }
    return pts;
  })();

  const startTot = CALC_C.reduce((a, l) => a + startV[l], 0);
  const contribTot = monthly * months;
  const projEnd = expPath[expPath.length - 1];
  const investedCap = startTot + contribTot;
  const gainC = projEnd - investedCap;
  const baseYear = 2026;
  const targetNum = numv(calcTarget);
  const rIdx = targetNum ? expPath.findIndex((v) => v >= targetNum) : -1;

  const targetNote = !targetNum
    ? "Set a target to track progress towards it."
    : rIdx >= 0
      ? `On the expected path you reach €${Math.round(targetNum).toLocaleString("en-US")} around ${baseYear + rIdx} (year ${rIdx} of the projection).`
      : `Target €${Math.round(targetNum).toLocaleString("en-US")} is not reached within ${years}y on the expected path — projected ${hideValues ? VALUE_MASK : eur(projEnd)}, a gap of ${hideValues ? VALUE_MASK : eur(targetNum - projEnd)}.`;

  const calcTargetStr = calcTarget === "" ? "" : Number(calcTarget).toLocaleString("en-US");
  const gainStr = hideValues ? VALUE_MASK : (gainC >= 0 ? "+" : "−") + eur(Math.abs(gainC));

  return (
    <>
      <div className="subhead">
        <div>
          <div className="ttl">Calculations</div>
          <div className="asof">Project your portfolio value under your own return and contribution assumptions</div>
        </div>
      </div>
      <div className="body">
        <div className="card calcass">
          <div className="cardttl">Assumptions</div>
          <div className="caltable">
            <div className="calhd">
              <span>Asset class</span>
              <span className="r">Expected return / yr</span>
            </div>
            {CALC_C.map((l) => (
              <div className="calr" key={l}>
                <span className="tgtlbl">{l}</span>
                <span className="tgtinwrap r">
                  <span className="tgtbox">
                    <input className="tgtinner num" type="number" value={calcRet[l]} onChange={(e) => setCalcRet(l, e.target.value)} />
                    <span className="tgtpct">%</span>
                  </span>
                </span>
              </div>
            ))}
          </div>
          <div className="calfoot">
            <div className="calfi">
              <span className="calfk">Monthly investment</span>
              <span className="tgtbox calfbox">
                <span className="calfeur">€</span>
                <input className="tgtinner num calfin" type="number" value={calcMonthly} onChange={(e) => setCalcMonthly(e.target.value)} />
              </span>
            </div>
            <div className="calfi">
              <span className="calfk">Target portfolio size</span>
              <span className="calftwrap">
                <span className="calfeur">€</span>
                <input className="calftin2 num" type="text" inputMode="numeric" value={calcTargetStr} onChange={(e) => setCalcTarget(e.target.value)} />
              </span>
            </div>
            <div className="calfi">
              <span className="calfk">Horizon</span>
              <div className="periodrow">
                {YEARS.map((y) => (
                  <button key={y} className={"pbtn" + (years === y ? " on" : "")} onClick={() => setCalcYears(y)}>
                    {y}y
                  </button>
                ))}
              </div>
            </div>
            <div className="calfi">
              <span className="calfk">Allocation basis</span>
              <div className="selwrap">
                <select
                  className="sel"
                  value={calcAllocMode}
                  onChange={(e) => setCalcAllocMode(e.target.value as "target" | "current")}
                >
                  <option value="target">Target allocation</option>
                  <option value="current">Current allocation</option>
                </select>
                <IconChevronDown className="selcv" size="16" />
              </div>
            </div>
          </div>
        </div>

        <div className="kstrip k4cal">
          <div className="kc">
            <div className="klbl">Projected value · {years}y</div>
            <div className="knum num">{hideValues ? VALUE_MASK : eur(projEnd)}</div>
          </div>
          <div className="kc">
            <div className="klbl">Invested capital</div>
            <div className="knum num">{hideValues ? VALUE_MASK : eur(investedCap)}</div>
          </div>
          <div className="kc">
            <div className="klbl">Of which contributions</div>
            <div className="knum num">{eur(contribTot)}</div>
          </div>
          <div className="kc">
            <div className="klbl">Expected gain</div>
            <div className={"knum num " + (gainC >= 0 ? "up" : "down")}>{gainStr}</div>
          </div>
        </div>

        <div className="card calcchart">
          <div className="cardttl sm">Projected portfolio value</div>
          <div className="calchartwrap">
            <ProjectionChart exp={expPath} target={targetNum} baseYear={baseYear} hoverIdx={calcHover} onHover={setCalcHover} mask={hideValues} />
          </div>
          <div className="perflegend callegend">
            <span className="lg lgp">Expected path</span>
            <span className="calbandt">Target</span>
          </div>
          <div className="targetnote">{targetNote}</div>
        </div>
      </div>
    </>
  );
}
