import type { FeeTable } from '../tariffs/schema'
import { feeFor } from './fees'
import type { SplitOpts, SplitResult, Tx } from './types'

const MAX_PERCENT_MULTIPLES = 50

function candidates(table: FeeTable, { step, minTx, maxTxAmount }: SplitOpts): number[] {
  const down = (x: number) => Math.floor(Math.min(x, maxTxAmount) / step) * step
  const raw: number[] = table.map((t) => down(t.max))
  const pct = table.filter((t) => 'feePercent' in t)
  const multiplesIn = (t: { min: number; max: number }) => {
    const hi = down(t.max)
    const lo = Math.ceil(t.min / step) * step
    return hi >= lo ? (hi - lo) / step + 1 : 0
  }
  const totalMultiples = pct.reduce((s, t) => s + multiplesIn(t), 0)
  for (const t of pct) {
    if (totalMultiples < MAX_PERCENT_MULTIPLES) {
      for (let a = Math.ceil(t.min / step) * step; a <= down(t.max); a += step) raw.push(a)
    } else {
      raw.push(Math.ceil(t.min / step) * step, down(t.max))
    }
  }
  return [...new Set(raw)]
    .filter((a) => a >= minTx && a <= maxTxAmount && feeFor(table, a) !== null)
    .sort((a, b) => b - a)
}

/** Cheapest split of `amount` into at most opts.maxTx transactions (spec §5.1). */
export function optimizeSplit(table: FeeTable, amount: number, opts: SplitOpts): SplitResult {
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, reason: 'invalid_amount' }
  if (amount < opts.minTx) return { ok: false, reason: 'below_min' }
  if (amount > opts.maxTx * opts.maxTxAmount) return { ok: false, reason: 'too_large' }

  const cands = candidates(table, opts)
  const fees = cands.map((a) => feeFor(table, a)!)
  const minFee = table.length
    ? Math.min(...table.map((t) => ('fee' in t ? t.fee : Math.ceil((Math.max(t.min, 1) * t.feePercent) / 100))))
    : 0

  type Best = { total: number; k: number; txs: Tx[] }
  let best = null as Best | null
  const chosen: Tx[] = []

  const search = (slots: number, from: number, sum: number, cost: number) => {
    if (slots === 0) {
      const rest = amount - sum
      if (rest < opts.minTx || rest > opts.maxTxAmount) return
      const f = feeFor(table, rest)
      if (f === null) return
      const total = cost + f
      if (!best || total < best.total) {
        best = { total, k: chosen.length + 1, txs: [...chosen, { amount: rest, fee: f }] }
      }
      return
    }
    for (let i = from; i < cands.length; i++) {
      const s = sum + cands[i]
      const c = cost + fees[i]
      if (s >= amount || (best && c >= best.total)) continue
      chosen.push({ amount: cands[i], fee: fees[i] })
      search(slots - 1, i, s, c)
      chosen.pop()
    }
  }

  for (let k = 1; k <= opts.maxTx; k++) {
    if (k * opts.maxTxAmount < amount) continue
    if (best && best.k < k && k * minFee >= best.total) break
    search(k - 1, 0, 0, 0)
  }

  const single = amount <= opts.maxTxAmount ? feeFor(table, amount) : null
  if (!best) return { ok: false, reason: 'unavailable' }
  const b = best
  return {
    ok: true,
    transactions: b.txs.sort((x, y) => y.amount - x.amount),
    total: b.total,
    single,
    savings: single === null ? 0 : single - b.total,
  }
}
