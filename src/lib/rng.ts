// Deterministic helpers ported from the prototype so generated price series /
// sparklines render identically to the design. Pure, seed-driven, no Math.random.

/** Linear congruential generator — returns a function yielding [0,1). */
export function lcg(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Generate an `n`-point random-walk series from a seed, drift and volatility. */
export function gen(seed: number, drift: number, vol: number, n: number): number[] {
  const r = lcg(seed);
  const a = [100];
  for (let i = 1; i < n; i++) {
    a.push(a[i - 1] * (1 + drift + (r() - 0.5) * vol));
  }
  return a;
}

/** Rebase a series so the first point is 100. */
export function rebase(a: number[]): number[] {
  const f = a[0];
  return a.map((v) => (v / f) * 100);
}
