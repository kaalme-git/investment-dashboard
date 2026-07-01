// Number / currency formatting — ported from the prototype's utils.
// The minus sign is U+2212 (−), matching the design exactly.

export function eur(n: number): string {
  return "€" + Math.round(n).toLocaleString("en-US");
}

export function sgn(n: number, dp = 1): string {
  return (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(dp) + "%";
}

/** Perceived luminance of a #rrggbb colour — used to pick white/black text on tiles. */
export function lum(hex: string): number {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
