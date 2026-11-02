import type { FeeTable } from '../../src/tariffs/schema'

/** Test-only reference: exhaustive search over all partitions of `amount`
 * into at most `maxTx` parts, each a multiple of `step`. Independent of optimizeSplit. */
export function bruteforce(
  table: FeeTable, amount: number, step: number, maxTx: number, minTx: number, maxTxAmount: number,
): { total: number; k: number } | null {
  const fee = (a: number): number | null => {
    const tier = table.find((t) => a >= t.min && a <= t.max)
    if (!tier) return null
    return 'fee' in tier ? tier.fee : Math.ceil((a * tier.feePercent) / 100)
  }
  let best: { total: number; k: number } | null = null
  const rec = (left: number, maxPart: number, k: number, cost: number) => {
    if (left === 0) {
      if (k > 0 && (!best || cost < best.total || (cost === best.total && k < best.k))) best = { total: cost, k }
      return
    }
    if (k === maxTx) return
    for (let p = Math.min(left, maxPart); p >= step; p -= step) {
      if (p < minTx || p > maxTxAmount) continue
      const f = fee(p)
      if (f === null) continue
      rec(left - p, p, k + 1, cost + f)
    }
  }
  rec(amount, amount, 0, 0)
  return best
}
