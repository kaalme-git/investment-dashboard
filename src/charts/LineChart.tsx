import { sgn } from "../data/format";

interface Props {
  a: number[]; // portfolio series (rebased to 100)
  b: number[]; // benchmark series
  accent: string;
  height: number;
  gradId: string;
  benchName?: string;
  dates?: string[];
  fill?: boolean;
  hoverIdx?: number | null;
  onHover?: (i: number | null) => void;
}

/** Portfolio-vs-benchmark line chart — ported from the prototype's line().
 *  Stretched SVG (preserveAspectRatio:none); tooltip is an HTML overlay. */
export default function LineChart({
  a, b, accent, height, gradId, benchName = "Index", dates, fill, hoverIdx = null, onHover,
}: Props) {
  const w = 760;
  const pad = 6;
  const padB = 4;
  const all = a.concat(b);
  let mn = Math.min(...all);
  let mx = Math.max(...all);
  const sp = (mx - mn) * 0.14 || 1;
  mn -= sp;
  mx += sp;

  const X = (i: number) => pad + (i * (w - 2 * pad)) / (a.length - 1);
  const Y = (v: number) => height - padB - ((v - mn) / (mx - mn)) * (height - padB - pad);
  const d = (arr: number[]) => arr.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join(" ");
  const area = d(a) + " L" + X(a.length - 1).toFixed(1) + " " + (height - padB) + " L" + X(0).toFixed(1) + " " + (height - padB) + " Z";

  function handleMove(e: React.MouseEvent) {
    if (!onHover) return;
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    let f = (e.clientX - rect.left) / rect.width;
    f = Math.max(0, Math.min(1, f));
    const i = Math.round(f * (a.length - 1));
    if (i !== hoverIdx) onHover(i);
  }

  const xpct = hoverIdx != null ? (X(hoverIdx) / w) * 100 : 0;
  const right = xpct > 58;

  return (
    <div style={{ position: "relative", width: "100%", height: fill ? "100%" : height + "px" }}>
      <svg viewBox={`0 0 ${w} ${height}`} width="100%" height="100%" preserveAspectRatio="none" style={{ display: "block" }}>
        <defs>
          <linearGradient id={gradId} x1={0} y1={0} x2={0} y2={1}>
            <stop offset="0%" stopColor={accent} stopOpacity={0.16} />
            <stop offset="100%" stopColor={accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradId})`} />
        <path d={d(b)} fill="none" stroke="#9b9b9b" strokeWidth={1.4} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        <path d={d(a)} fill="none" stroke={accent} strokeWidth={2.2} vectorEffect="non-scaling-stroke" />
        {hoverIdx != null && (
          <>
            <line x1={X(hoverIdx)} y1={pad} x2={X(hoverIdx)} y2={height - padB} stroke="#bdbdbd" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <circle cx={X(hoverIdx)} cy={Y(b[hoverIdx])} r={3.5} fill="#fff" stroke="#9b9b9b" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            <circle cx={X(hoverIdx)} cy={Y(a[hoverIdx])} r={4} fill={accent} stroke="#fff" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          </>
        )}
        {onHover && (
          <rect x={0} y={0} width={w} height={height} fill="transparent" onMouseMove={handleMove} onMouseLeave={() => onHover(null)} style={{ cursor: "crosshair" }} />
        )}
      </svg>
      {hoverIdx != null && (
        <div
          style={{
            position: "absolute",
            top: 6,
            [right ? "right" : "left"]: `calc(${right ? 100 - xpct : xpct}% + 12px)`,
            background: "#fff",
            border: "1px solid var(--c-br-subtle)",
            borderRadius: 8,
            boxShadow: "var(--shadow-md)",
            padding: "9px 11px",
            pointerEvents: "none",
            zIndex: 5,
          }}
        >
          {dates && (
            <div style={{ fontSize: 10.5, color: "var(--c-fg-subtle)", fontFamily: "var(--font-family-mono)", marginBottom: 6 }}>
              {dates[hoverIdx]}
            </div>
          )}
          <TipRow color={accent} label="Portfolio" val={a[hoverIdx]} />
          <TipRow color="#9b9b9b" label={benchName} val={b[hoverIdx]} marginTop={3} />
        </div>
      )}
    </div>
  );
}

function TipRow({ color, label, val, marginTop = 0 }: { color: string; label: string; val: number; marginTop?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, lineHeight: 1.5, whiteSpace: "nowrap", marginTop }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flex: "none" }} />
      <span style={{ color: "var(--c-fg-muted)" }}>{label}</span>
      <b className="num" style={{ marginLeft: "auto" }}>{val.toFixed(1)}</b>
      <b className="num" style={{ color: val >= 100 ? "var(--c-fg-success)" : "var(--c-fg-error)" }}>{sgn(val - 100)}</b>
    </div>
  );
}
