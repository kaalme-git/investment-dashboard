interface Props {
  data: number[]; // real recent weekly closes (EUR)
  up: boolean;
}

/** ~3-month sparkline of an instrument's real weekly closing prices. */
export default function Sparkline({ data, up }: Props) {
  const w = 84;
  const h = 24;
  const pad = 2;
  if (!data || data.length < 2) return <svg width={w} height={h} />;
  const mn = Math.min(...data);
  const mx = Math.max(...data);
  const X = (i: number) => pad + (i * (w - 2 * pad)) / (data.length - 1);
  const Y = (v: number) => h - pad - ((v - mn) / (mx - mn || 1)) * (h - 2 * pad);
  const d = data.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join(" ");
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
