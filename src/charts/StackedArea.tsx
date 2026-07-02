import type { AllocSeg } from "../data/types";

interface Props {
  segs: AllocSeg[];
  series: number[][]; // real per-band weight (%) history, aligned to `segs`
  hoverIdx?: number | null;
  onEnter?: (i: number) => void;
  onLeave?: () => void;
}

/** 100% stacked-area chart of the REAL allocation history. `series[i]` is band
 *  `i`'s weight over time (reconstructed from transactions + prices in live.ts).
 *  Shares hoverIdx with the donut + legend. */
export default function StackedArea({ segs, series, hoverIdx = null, onEnter, onLeave }: Props) {
  const w = 760;
  const h = 200;
  const pad = 4;
  const n = Math.max(1, series[0]?.length ?? 1);

  // normalise each time-step to 100% (values already sum to ~100, but guard drift)
  const norm = segs.map(() => new Array(n).fill(0));
  for (let t = 0; t < n; t++) {
    let sum = 0;
    for (let i = 0; i < segs.length; i++) sum += series[i]?.[t] ?? 0;
    for (let i = 0; i < segs.length; i++) norm[i][t] = sum > 0 ? ((series[i]?.[t] ?? 0) / sum) * 100 : 0;
  }

  const X = (t: number) => pad + (t * (w - 2 * pad)) / (n - 1);
  const Y = (v: number) => pad + ((100 - v) / 100) * (h - 2 * pad);

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
          opacity: hoverIdx != null && hoverIdx !== i ? 0.32 : 1,
          transition: "opacity .16s ease",
          cursor: "pointer",
        }}
        onMouseEnter={onEnter ? () => onEnter(i) : undefined}
        onMouseLeave={onLeave}
      />
    );
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ display: "block" }}>
      {paths}
    </svg>
  );
}
