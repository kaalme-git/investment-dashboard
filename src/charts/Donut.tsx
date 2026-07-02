import type { AllocSeg } from "../data/types";

interface Props {
  segs: AllocSeg[];
  size?: number;
  thick?: number;
  hoverIdx?: number | null;
  selectedIdx?: number | null;
  onEnter?: (i: number) => void;
  onLeave?: () => void;
  onSelect?: (i: number) => void;
}

/** Donut chart — ported from the prototype's donut(). Hovering a slice grows it
 *  and dims the others (shared via hoverIdx); an optional selected slice stays lifted. */
export default function Donut({ segs, size = 200, thick = 30, hoverIdx = null, selectedIdx = null, onEnter, onLeave, onSelect }: Props) {
  const r = size / 2 - thick / 2 - 3;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      {segs.map((s, i) => {
        const len = (s.pctNum / 100) * C;
        const lifted = hoverIdx === i || selectedIdx === i;
        const dim = (hoverIdx != null || selectedIdx != null) && !lifted;
        const offset = -acc;
        acc += len;
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={lifted ? thick + 7 : thick}
            strokeDasharray={`${len} ${C - len}`}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            onMouseEnter={onEnter ? () => onEnter(i) : undefined}
            onMouseLeave={onLeave}
            onClick={onSelect ? () => onSelect(i) : undefined}
            style={{
              opacity: dim ? 0.32 : 1,
              cursor: onSelect || onEnter ? "pointer" : "default",
              transition: "stroke-width .16s ease, opacity .16s ease",
            }}
          />
        );
      })}
    </svg>
  );
}
