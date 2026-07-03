import { useStore } from "../../store/useStore";
import { eur } from "../../data/format";
import { ACCENT, } from "../../data/portfolio";
import { VALUE_MASK } from "../../data/live";

const kEur = (v: number) => (v >= 1000 ? "€" + (v / 1000).toFixed(v >= 10000 ? 0 : 1) + "k" : "€" + Math.round(v));

export default function DividendsTab() {
  const dividends = useStore((s) => s.portfolio.dividends);
  const hideValues = useStore((s) => s.hideValues);
  // privacy mode: bar heights stay (relative view), the € numbers don't
  const mEur = (v: number) => (hideValues ? VALUE_MASK : eur(v));
  const mK = (v: number) => (hideValues ? "•••" : kEur(v));
  const hasEstimate = dividends.some((d) => d.estimated > 0);
  const anyDivs = dividends.some((d) => d.actual > 0 || d.estimated > 0);
  const curYear = new Date().getFullYear();
  const yr = (y: number) => dividends.find((d) => d.year === y);
  const lifetime = dividends.reduce((s, d) => s + d.actual, 0);

  // chart geometry (SVG viewBox)
  const W = 760, H = 320, padL = 52, padR = 16, padT = 18, padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const bottom = padT + plotH;
  const max = Math.max(1, ...dividends.map((d) => d.actual + d.estimated));
  const stepV = niceStep(max / 4);
  const top = Math.ceil(max / stepV) * stepV;
  const yTicks = Array.from({ length: Math.round(top / stepV) + 1 }, (_, i) => i * stepV);
  const n = Math.max(1, dividends.length);
  const slot = plotW / n;
  const barW = Math.min(56, slot * 0.5);
  const yOf = (v: number) => bottom - (v / top) * plotH;

  return (
    <>
      <div className="card divcard">
        <div className="cardhd sm">
          <span className="cardttl">Dividends received per year</span>
          <div className="divlegend">
            <span className="dlg dlg-act">Received</span>
            {hasEstimate && <span className="dlg dlg-est">Estimated</span>}
          </div>
        </div>

        {!anyDivs ? (
          <div className="emptyhint" style={{ padding: "26px 4px" }}>
            No dividends recorded yet. Once your transactions include dividend payments, they'll appear here by year.
          </div>
        ) : (
          <div className="divchartwrap">
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet">
              <defs>
                <pattern id="divHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="6" height="6" fill="#c9d0ff" />
                  <line x1="0" y1="0" x2="0" y2="6" stroke={ACCENT} strokeWidth="2" opacity="0.55" />
                </pattern>
              </defs>

              {yTicks.map((t) => (
                <g key={t}>
                  <line x1={padL} y1={yOf(t)} x2={W - padR} y2={yOf(t)} stroke="#eceef2" strokeWidth="1" />
                  <text x={padL - 8} y={yOf(t) + 3.5} textAnchor="end" className="divaxis">{mK(t)}</text>
                </g>
              ))}

              {dividends.map((d, i) => {
                const cx = padL + slot * i + slot / 2;
                const x = cx - barW / 2;
                const ha = (d.actual / top) * plotH;
                const he = (d.estimated / top) * plotH;
                const total = d.actual + d.estimated;
                const future = d.year > curYear;
                return (
                  <g key={d.year}>
                    {/* received (solid) */}
                    {ha > 0 && <rect x={x} y={bottom - ha} width={barW} height={ha} rx="2" fill={ACCENT} />}
                    {/* estimated (hatched, on top) */}
                    {he > 0 && (
                      <rect x={x} y={bottom - ha - he} width={barW} height={he} rx="2" fill="url(#divHatch)" stroke={ACCENT} strokeWidth="1" strokeDasharray="3 2" />
                    )}
                    {total > 0 && <text x={cx} y={bottom - ha - he - 6} textAnchor="middle" className="divval">{mK(total)}</text>}
                    <text x={cx} y={bottom + 18} textAnchor="middle" className={"divyear" + (future ? " divfut" : "")}>
                      {d.year}{future ? "e" : ""}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {anyDivs && (
        <div className="kstrip k4cal">
          <div className="kc">
            <div className="klbl">Received {curYear} (YTD)</div>
            <div className="knum num">{mEur(yr(curYear)?.actual || 0)}</div>
          </div>
          <div className="kc">
            <div className="klbl">Est. {curYear + 1}</div>
            <div className="knum num">{hasEstimate ? mEur(yr(curYear + 1)?.estimated || 0) : "—"}</div>
          </div>
          <div className="kc">
            <div className="klbl">Est. {curYear + 2}</div>
            <div className="knum num">{hasEstimate ? mEur(yr(curYear + 2)?.estimated || 0) : "—"}</div>
          </div>
          <div className="kc">
            <div className="klbl">Lifetime received</div>
            <div className="knum num">{mEur(lifetime)}</div>
          </div>
        </div>
      )}

      <div className="srcnote">
        The estimated future dividends are for your current holdings, shown as the hatched remainder on top of what
        you've already received. They're based on Inderes analyst dividend estimates, falling back to Yahoo Finance
        trailing dividend figures and then to the trailing dividends from your own transactions when an Inderes estimate
        isn't available.
      </div>
    </>
  );
}

// round a raw step up to a clean 1/2/2.5/5 × 10^k value
function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * pow;
}
