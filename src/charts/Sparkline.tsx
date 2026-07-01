import { gen } from "../lib/rng";

interface Props {
  seed: number;
  up: boolean;
}

/** 3-month sparkline — ported from the prototype's spark(). The series is the
 *  deterministic gen(seed, ±drift, vol, 20) used in the holdings table. */
export default function Sparkline({ seed, up }: Props) {
  const arr = gen(seed, up ? 0.004 : -0.004, 0.045, 20);
  const w = 84;
  const h = 24;
  const pad = 2;
  const mn = Math.min(...arr);
  const mx = Math.max(...arr);
  const X = (i: number) => pad + (i * (w - 2 * pad)) / (arr.length - 1);
  const Y = (v: number) => h - pad - ((v - mn) / (mx - mn || 1)) * (h - 2 * pad);
  const d = arr.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <path
        d={d}
        fill="none"
        stroke={up ? "#256100" : "#ad0101"}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
