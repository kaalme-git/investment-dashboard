import { lcg } from "../lib/rng";
import type { AllocSeg } from "../data/types";

interface Props {
  segs: AllocSeg[];
  n?: number;
  hoverIdx?: number | null;
  onEnter?: (i: number) => void;
  onLeave?: () => void;
}

/** 100% stacked-area chart — ported from the prototype's stackedArea().
 *  Each band ends at its current weight and drifts back deterministically over
 *  `n` time-steps. Shares hoverIdx with the donut + legend. */
export default function StackedArea({ segs, n = 13, hoverIdx = null, onEnter, onLeave }: Props) {
  const w = 760;
  const h = 200;
  const pad = 4;

  // deterministic per-band series that converges to the current weight at t=n-1
  const series = segs.map((s, i) => {
    const r = lcg(900 + i * 13);
    const arr: number[] = [];
    for (let t = 0; t < n; t++) {
      const f = t / (n - 1);
      arr.push(Math.max(0.05, (s.pctNum || 0.1) * (1 + (r() - 0.5) * 0.7 * (1 - f))));
    }
    arr[n - 1] = s.pctNum || 0.1;
    return arr;
  });

  // normalise each time-step to 100%
  const norm = segs.map(() => new Array(n).fill(0));
  for (let t = 0; t < n; t++) {
    let sum = 0;
    for (let i = 0; i < segs.length; i++) sum += series[i][t];
    for (let i = 0; i < segs.length; i++) norm[i][t] = (series[i][t] / sum) * 100;
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
