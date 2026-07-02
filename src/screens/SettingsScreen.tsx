import { useStore } from "../store/useStore";

const TGT_LABELS = ["Equities", "Fixed income", "Other", "Cash & equivalent"];
const EDIT_LABELS = ["Equities", "Fixed income", "Other"];

const numv = (v: number | "") => (typeof v === "number" ? v : 0);
const driftStr = (d: number) => (d >= 0 ? "+" : "−") + Math.abs(d).toFixed(1);

interface Row {
  label: string;
  curStr: string;
  editable: boolean;
  inputVal: number | "";
  targetStr: string;
  curStyle: React.CSSProperties;
  markStyle: React.CSSProperties;
  driftStr: string;
  driftCls: string;
  onChange?: (raw: string) => void;
}

// Settings page — reached only via the account menu (avatar → Settings). Holds
// the investment strategy + target allocation (formerly the "Strategy" tab).
export default function SettingsScreen() {
  const strategyText = useStore((s) => s.strategyText);
  const setStrategyText = useStore((s) => s.setStrategyText);
  const targets = useStore((s) => s.targets);
  const setTarget = useStore((s) => s.setTarget);
  const assetCurrent = useStore((s) => s.portfolio.assetCurrent);
  const activePctNum = useStore((s) => s.portfolio.activePctNum);
  const passivePctNum = useStore((s) => s.portfolio.passivePctNum);
  // Active/Passive targets are the tilt of your INVESTED assets (cash is its own
  // allocation bucket, not active/passive), so show current as a share of invested.
  const invested = activePctNum + passivePctNum;
  const activeInv = invested > 0 ? (activePctNum / invested) * 100 : 0;
  const passiveInv = invested > 0 ? (passivePctNum / invested) * 100 : 0;

  const editSum = EDIT_LABELS.reduce((s, l) => s + numv(targets[l]), 0);
  const cashTgt = Math.max(0, 100 - editSum);
  const effTgt = (l: string) => (l === "Cash & equivalent" ? cashTgt : numv(targets[l]));

  const targetRows: Row[] = TGT_LABELS.map((l) => {
    const cur = assetCurrent[l] || 0;
    const editable = l !== "Cash & equivalent";
    const tg = effTgt(l);
    const drift = cur - tg;
    return {
      label: l,
      curStr: cur.toFixed(1) + "%",
      editable,
      inputVal: targets[l],
      targetStr: tg.toFixed(0) + "%",
      curStyle: { width: Math.min(cur, 100) + "%" },
      markStyle: { left: Math.min(tg, 100) + "%" },
      driftStr: driftStr(drift),
      driftCls: Math.abs(drift) > 5 ? "tgtwarn" : "",
      onChange: editable ? (raw) => setTarget(l, raw) : undefined,
    };
  });

  const tgtSum = editSum + cashTgt;

  const actTgt = numv(targets.Active);
  const styleDefs = [
    { label: "Active", cur: activeInv, tg: actTgt, editable: true, inputVal: targets.Active },
    { label: "Passive", cur: passiveInv, tg: Math.max(0, 100 - actTgt), editable: false, inputVal: "" as number | "" },
  ];
  const styleRows: Row[] = styleDefs.map((d) => {
    const drift = d.cur - d.tg;
    return {
      label: d.label,
      curStr: d.cur.toFixed(1) + "%",
      editable: d.editable,
      inputVal: d.inputVal,
      targetStr: d.tg.toFixed(0) + "%",
      curStyle: { width: Math.min(d.cur, 100) + "%" },
      markStyle: { left: Math.min(d.tg, 100) + "%" },
      driftStr: driftStr(drift),
      driftCls: Math.abs(drift) > 5 ? "tgtwarn" : "",
      onChange: d.editable ? (raw) => setTarget("Active", raw) : undefined,
    };
  });

  return (
    <>
      <div className="subhead">
        <div>
          <div className="ttl">Settings</div>
          <div className="asof">
            Your investment strategy and target allocation — read by the AI when it analyses your portfolio
          </div>
        </div>
      </div>
      <div className="body">
        <div className="stratgrid">
          <div className="card">
            <div className="cardttl">Investment strategy</div>
            <textarea className="stratin" rows={9} value={strategyText} onChange={(e) => setStrategyText(e.target.value)} />
            <div className="modehint">
              Describe your goals, risk tolerance, time horizon and rules. The “Ask about my portfolio” assistant uses
              this to ground its analysis.
            </div>
          </div>

          <div className="card">
            <div className="cardttl">Target allocation</div>
            <TargetTable head="Asset class" rows={targetRows} />
            <div className="tgtfoot">
              <span>Target total</span>
              <span className={"num " + (tgtSum === 100 ? "" : "tgtwarn")}>{tgtSum.toFixed(0)}%</span>
            </div>
            <div className="tgtsub">Active vs passive</div>
            <TargetTable head="Style" rows={styleRows} />
            <div className="modehint">
              Bar = current weight; the line marks your target. Drift beyond ±5pp suggests rebalancing. Individual stocks
              and actively-managed funds (incl. fixed income) count as active, index funds and ETFs as passive, shown as
              a share of invested assets. Cash &amp; equivalents are their own bucket in the allocation view.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function TargetTable({ head, rows }: { head: string; rows: Row[] }) {
  return (
    <div className="tgttable">
      <div className="tgthd">
        <span>{head}</span>
        <span />
        <span className="r">Current</span>
        <span className="r">Target</span>
        <span className="r">Drift</span>
      </div>
      {rows.map((r) => (
        <div className="tgtr" key={r.label}>
          <span className="tgtlbl">{r.label}</span>
          <div className="tgttrack">
            <div className="tgtcur" style={r.curStyle} />
            <div className="tgtmark" style={r.markStyle} />
          </div>
          <span className="num tgtcurv r">{r.curStr}</span>
          <span className="tgtinwrap r">
            {r.editable ? (
              <span className="tgtbox">
                <input
                  className="tgtinner num"
                  type="number"
                  value={r.inputVal}
                  onChange={(e) => r.onChange?.(e.target.value)}
                />
                <span className="tgtpct">%</span>
              </span>
            ) : (
              <span className="num tgtfix">{r.targetStr}</span>
            )}
          </span>
          <span className={"num tgtdrift r " + r.driftCls}>{r.driftStr}</span>
        </div>
      ))}
    </div>
  );
}
