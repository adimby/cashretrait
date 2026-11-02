import type { FeeTable } from '../tariffs/schema'

/** A line α + β·a lying below the single-transaction fee function on the whole table. */
export type Line = { a: number; b: number }

/**
 * Lower bounds on the cost of covering R Ar with exactly p transactions, whatever the split.
 * Built from the lower convex hull of the fee graph: each hull edge extended is a line below
 * fee(a) for every valid a, so p transactions summing to R cost ≥ p·α + β·R. Exact (never above
 * the true optimum); used only for pruning.
 */
export function feeLowerBound(table: FeeTable, minTx: number, maxTxAmount: number): (r: number, p: number) => number {
  const lines = feeLowerLines(table, minTx, maxTxAmount)
  return (r, p) => {
    let best = 0
    for (const l of lines) best = Math.max(best, p * l.a + l.b * r)
    // Float slack on the safe side: the bound must never exceed the true (integer) cost.
    return best * (1 - 1e-9) - 1e-6
  }
}

/** The lines behind feeLowerBound: fee(a) ≥ l.a + l.b·a for every valid single amount a (l.b ≥ 0 not guaranteed). */
export function feeLowerLines(table: FeeTable, minTx: number, maxTxAmount: number): Line[] {
  const pts: [number, number][] = []
  let minFee = Infinity
  for (const t of table) {
    const lo = Math.max(t.min, minTx, 1)
    const hi = Math.min(t.max, maxTxAmount)
    if (hi < lo) continue
    const y = (x: number) => ('fee' in t ? t.fee : (x * t.feePercent) / 100)
    pts.push([lo, y(lo)], [hi, y(hi)])
    minFee = Math.min(minFee, 'fee' in t ? t.fee : Math.ceil((lo * t.feePercent) / 100))
  }
  if (!pts.length) return []
  pts.sort((u, v) => u[0] - v[0] || u[1] - v[1])
  // Andrew's monotone chain, lower hull.
  const hull: [number, number][] = []
  for (const p of pts) {
    while (hull.length >= 2) {
      const [o, q] = [hull[hull.length - 2], hull[hull.length - 1]]
      if ((q[0] - o[0]) * (p[1] - o[1]) - (q[1] - o[1]) * (p[0] - o[0]) <= 0) hull.pop()
      else break
    }
    hull.push(p)
  }
  const lines: Line[] = [{ a: minFee, b: 0 }]
  for (let i = 1; i < hull.length; i++) {
    const [x1, y1] = hull[i - 1]
    const [x2, y2] = hull[i]
    if (x2 === x1) continue
    const b = (y2 - y1) / (x2 - x1)
    lines.push({ a: y1 - b * x1, b })
  }
  return lines
}
