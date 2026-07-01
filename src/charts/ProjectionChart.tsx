interface Props {
  exp: number[];
  target: number;
  height?: number;
  baseYear: number;
  /** Optional per-point x-axis labels (e.g. months). Falls back to baseYear+i. */
  labels?: string[];
  hoverIdx?: number | null;
  onHover?: (i: number | null) => void;
}

const esShort = (v: number) =>
  v >= 1e6 ? "€" + (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + "M" : v >= 1e3 ? "€" + Math.round(v / 1e3) + "k" : "€" + Math.round(v);

/** Forward-projection line chart — ported from the prototype's projChart().
 *  Euro Y-axis + calendar-year X-axis as HTML overlays (the SVG is stretched
 *  with preserveAspectRatio:none, so axis text can't live inside it). */
export default function ProjectionChart({ exp, target, height = 250, baseYear, labels: xLabels, hoverIdx = null, onHover }: Props) {
  const w = 760;
  const padL = 64;
  const padR = 12;
  const padT = 10;
  const padB = 24;
  const n = exp.length;

  const vals = target ? exp.concat(target) : exp.slice();
  let mn = Math.min(...vals, 0);
  let mx = Math.max(...vals);
  const sp = (mx - mn) * 0.08 || 1;
  mx += sp;

  const X = (i: number) => padL + (i * (w - padL - padR)) / (n - 1);
  const Y = (v: number) => height - padB - ((v - mn) / (mx - mn)) * (height - padB - padT);
  const line = (a: number[]) => a.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join(" ");
  const area = line(exp) + " L" + X(n - 1).toFixed(1) + " " + (height - padB) + " L" + X(0).toFixed(1) + " " + (height - padB) + " Z";

  const grid: JSX.Element[] = [];
  const labels: JSX.Element[] = [];
  for (let i = 0; i <= 4; i++) {
    const v = mn + ((mx - mn) * i) / 4;
    const y = Y(v);
    grid.push(<line key={"g" + i} x1={padL} y1={y} x2={w - padR} y2={y} stroke="#eee" strokeWidth={1} vectorEffect="non-scaling-stroke" />);
    labels.push(
      <div key={"yl" + i} className="pcax" style={{ position: "absolute", left: 0, width: (padL / w) * 100 + "%", paddingRight: 6, boxSizing: "border-box", textAlign: "right", top: y - 6 + "px" }}>
        {esShort(v)}
      </div>,
    );
  }
  const xs = Math.ceil((n - 1) / 6) || 1;
  for (let i = 0; i < n; i += xs) {
    labels.push(
      <div key={"xl" + i} className="pcax" style={{ position: "absolute", left: (X(i) / w) * 100 + "%", transform: "translateX(-50%)", bottom: 3 }}>
        {xLabels ? xLabels[i] : baseYear + i}
      </div>,
    );
  }
  if (target) {
    labels.push(
      <div key="tgl" className="pcax pcaxt" style={{ position: "absolute", right: (padR / w) * 100 + "%", top: Y(target) - 16 + "px" }}>
        Target {esShort(target)}
      </div>,
    );
  }

  function handleMove(e: React.MouseEvent) {
    if (!onHover) return;
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    let f = (e.clientX - rect.left) / rect.width;
    f = Math.max(0, Math.min(1, f));
    const i = Math.round(f * (n - 1));
    if (i !== hoverIdx) onHover(i);
  }

  const xpct = hoverIdx != null ? (X(hoverIdx) / w) * 100 : 0;
  const right = xpct > 56;

  return (
    <div style={{ position: "relative", width: "100%", height: height + "px" }}>
      <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none" style={{ display: "block" }}>
        {grid}
        <path d={area} fill="#0000e6" opacity={0.08} />
        {target ? (
          <line x1={padL} y1={Y(target)} x2={w - padR} y2={Y(target)} stroke="#ad0101" strokeWidth={1.4} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
        ) : null}
        <path d={line(exp)} fill="none" stroke="#0000e6" strokeWidth={2.2} vectorEffect="non-scaling-stroke" />
        {hoverIdx != null && (
          <>
            <line x1={X(hoverIdx)} y1={padT} x2={X(hoverIdx)} y2={height - padB} stroke="#bdbdbd" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <circle cx={X(hoverIdx)} cy={Y(exp[hoverIdx])} r={4} fill="#0000e6" stroke="#fff" strokeWidth={1.5} />
          </>
        )}
        {onHover && (
          <rect x={padL} y={padT} width={w - padL - padR} height={height - padB - padT} fill="transparent" onMouseMove={handleMove} onMouseLeave={() => onHover(null)} style={{ cursor: "crosshair" }} />
        )}
      </svg>
      {labels}
      {hoverIdx != null && (
        <div
          style={{
            position: "absolute",
            top: 6,
            [right ? "right" : "left"]: `calc(${right ? 100 - xpct : xpct}% + 10px)`,
            background: "#fff",
            border: "1px solid var(--c-br-subtle)",
            borderRadius: 8,
            boxShadow: "var(--shadow-md)",
            padding: "8px 11px",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 5,
          }}
        >
          <div style={{ fontSize: 10.5, color: "var(--c-fg-subtle)", fontFamily: "var(--font-family-mono)", marginBottom: 4 }}>{xLabels ? xLabels[hoverIdx] : baseYear + hoverIdx}</div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{"€" + Math.round(exp[hoverIdx]).toLocaleString("en-US")}</div>
        </div>
      )}
    </div>
  );
}
