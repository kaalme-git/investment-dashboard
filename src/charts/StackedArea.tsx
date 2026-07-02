import { useState } from "react";
import type { AllocSeg } from "../data/types";

interface Props {
  segs: AllocSeg[];
  series: number[][]; // real per-band weight (%) history, aligned to `segs`
  dates?: string[]; // ISO dates aligned to the time steps (for the tooltip)
}

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "";

/** 100% stacked-area chart of the REAL allocation history. `series[i]` is band
 *  `i`'s weight over time (reconstructed from transactions + prices in live.ts).
 *  Hovering a band highlights it and shows an HTML tooltip (the SVG is stretched,
 *  so the tooltip can't live inside it) with the bucket, its share and the date. */
export default function StackedArea({ segs, series, dates }: Props) {
  const w = 760;
  const h = 200;
  const pad = 4;
  const n = Math.max(1, series[0]?.length ?? 1);
  const [hover, setHover] = useState<{ band: number; t: number; xPct: number; yPct: number } | null>(null);

  // normalise each time-step to 100% (values already sum to ~100, but guard drift)
  const norm = segs.map(() => new Array(n).fill(0));
  for (let t = 0; t < n; t++) {
    let sum = 0;
    for (let i = 0; i < segs.length; i++) sum += series[i]?.[t] ?? 0;
    for (let i = 0; i < segs.length; i++) norm[i][t] = sum > 0 ? ((series[i]?.[t] ?? 0) / sum) * 100 : 0;
  }

  const X = (t: number) => pad + (t * (w - 2 * pad)) / (n - 1);
  const Y = (v: number) => pad + ((100 - v) / 100) * (h - 2 * pad);

  function handleMove(e: React.MouseEvent<SVGPathElement>, band: number) {
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const xf = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const yf = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    setHover({ band, t: Math.round(xf * (n - 1)), xPct: xf * 100, yPct: yf * 100 });
  }

  const cum = new Array(n).fill(0);
  const paths = segs.map((seg, i) => {
    const lower = cum.slice();
    const upper = cum.map((c, t) => c + norm[i][t]);
    for (let t = 0; t < n; t++) cum[t] = upper[t];
    const top = upper.map((v, t) => X(t).toFixed(1) + " " + Y(v).toFixed(1));
    const bot = lower.map((v, t) => X(t).toFixed(1) + " " + Y(v).toFixed(1)).reverse();
    return (
      <path
        key={i}
        d={"M" + top.join(" L") + " L" + bot.join(" L") + " Z"}
        fill={seg.color}
        stroke="#fff"
        strokeWidth={0.6}
        style={{
          opacity: hover != null && hover.band !== i ? 0.32 : 1,
          transition: "opacity .16s ease",
          cursor: "crosshair",
        }}
        onMouseMove={(e) => handleMove(e, i)}
        onMouseLeave={() => setHover(null)}
      />
    );
  });

  const right = hover != null && hover.xPct > 55;
  const seg = hover != null ? segs[hover.band] : null;

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ display: "block", borderRadius: 7 }}>
        {paths}
      </svg>
      {hover != null && seg && (
        <div
          style={{
            position: "absolute",
            top: Math.min(Math.max(hover.yPct, 6), 62) + "%",
            [right ? "right" : "left"]: `calc(${right ? 100 - hover.xPct : hover.xPct}% + 12px)`,
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
          {dates?.[hover.t] && (
            <div style={{ fontSize: 10.5, color: "var(--c-fg-subtle)", fontFamily: "var(--font-family-mono)", marginBottom: 5 }}>
              {fmtDate(dates[hover.t])}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: seg.color, flex: "none" }} />
            <span style={{ color: "var(--c-fg-muted)", fontWeight: 600 }}>{seg.label}</span>
            <b className="num" style={{ marginLeft: 6 }}>{norm[hover.band][hover.t].toFixed(1)}%</b>
          </div>
        </div>
      )}
    </div>
  );
}
