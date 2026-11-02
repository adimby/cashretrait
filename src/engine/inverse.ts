import type { FeeTable } from '../tariffs/schema'
import { feeLowerBound } from './bounds'
import { optimizeSplit, prepareSplit } from './optimize'
import type { Fail, SplitOk, SplitOpts } from './types'

export type InverseInput = {
  net: number
  withdrawTable: FeeTable
  transferTable: FeeTable
  includeWithdrawalFee: boolean
  opts: SplitOpts
  /** Limits of the withdrawing operator, if different from the sender's (defaults to opts). */
  withdrawOpts?: SplitOpts
}
export type InverseResult =
  | {
      ok: true
      send: number
      transfer: SplitOk
      /** Optimal withdrawal of the full `net` (its cost R is in `total`, spec §5.2). */
      withdrawal: SplitOk
      total: number
      /**
       * Only when the withdrawal fee is not included: the recipient holds exactly `net`, so he cannot
       * execute `withdrawal` (he would also need R). This is what he can really take out of `net`.
       */
      takeOut?: MaxResult
    }
  | Fail

/** Amount to send so the recipient gets `net` (spec §5.2). */
export function inverse(i: InverseInput): InverseResult {
  const withdrawal = optimizeSplit(i.withdrawTable, i.net, i.withdrawOpts ?? i.opts)
  if (!withdrawal.ok) return withdrawal
  const send = i.includeWithdrawalFee ? i.net + withdrawal.total : i.net
  const transfer = optimizeSplit(i.transferTable, send, i.opts)
  if (!transfer.ok) return transfer
  const total = transfer.total + withdrawal.total
  if (i.includeWithdrawalFee) return { ok: true, send, transfer, withdrawal, total }
  return { ok: true, send, transfer, withdrawal, total, takeOut: maxWithdrawable(i.withdrawTable, i.net, i.withdrawOpts ?? i.opts) }
}

export type MaxResult = { ok: true; amount: number; withdrawal: SplitOk; remaining: number } | Fail

/**
 * Largest M (multiple of step) with M + optimal withdrawal cost ≤ balance (spec §5.3).
 *
 * Exact and fast. With C(M) the optimal cost of M, a valid M satisfies M + C(M) ≤ balance, with
 * C(M) ≥ LB(M) (lower convex hull of the fee graph, ≥ minFee, see bounds.ts) and, for any
 * splittable M, C(M) ≤ maxFeeBound = maxTx × (largest tier fee). The answer therefore lies in
 * [balance − maxFeeBound, balance − minFee]: scanning down from the top, the first M that fits is
 * the largest, and the scan ends at the latest at the first splittable M ≤ balance − maxFeeBound.
 * M with M + LB(M) > balance are rejected without searching; every other probe reuses one prepared
 * splitter (candidates, fees, bounds computed once) and only looks for a split within the budget
 * balance − M, which prunes the search hard. The split returned is optimizeSplit's own.
 */
export function maxWithdrawable(table: FeeTable, balance: number, opts: SplitOpts): MaxResult {
  if (!Number.isFinite(balance) || balance <= 0 || !(opts.step > 0)) return { ok: false, reason: 'invalid_amount' }
  if (!table.length) return { ok: false, reason: 'unavailable' }
  const step = opts.step
  const minFee = Math.min(...table.map((t) => ('fee' in t ? t.fee : Math.ceil((Math.max(t.min, 1) * t.feePercent) / 100))))
  const cap = Math.min(opts.maxTxAmount, Math.max(...table.map((t) => t.max)))
  const lb = feeLowerBound(table, opts.minTx, opts.maxTxAmount)
  const split = prepareSplit(table, opts)
  const lo = Math.ceil(Math.max(opts.minTx, 1) / step) * step
  // Upper bound is min(balance − minFee, max splittable); subtracting minFee from the cap as well would miss M = cap.
  const top = Math.min(balance - minFee, opts.maxTx * cap)
  for (let m = Math.floor(top / step) * step; m >= lo; m -= step) {
    const budget = balance - m
    let low = Infinity
    for (let k = Math.max(1, Math.ceil(m / cap)); k <= opts.maxTx; k++) low = Math.min(low, lb(m, k))
    if (low > budget) continue
    const w = split(m, budget)
    if (w.ok) return { ok: true, amount: m, withdrawal: w, remaining: budget - w.total }
  }
  return { ok: false, reason: 'insufficient' }
}
