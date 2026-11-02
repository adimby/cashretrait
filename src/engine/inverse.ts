import type { FeeTable } from '../tariffs/schema'
import { optimizeSplit } from './optimize'
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
export type InverseResult = { ok: true; send: number; transfer: SplitOk; withdrawal: SplitOk; total: number } | Fail

/** Amount to send so the recipient gets `net` (spec §5.2). */
export function inverse(i: InverseInput): InverseResult {
  const withdrawal = optimizeSplit(i.withdrawTable, i.net, i.withdrawOpts ?? i.opts)
  if (!withdrawal.ok) return withdrawal
  const send = i.includeWithdrawalFee ? i.net + withdrawal.total : i.net
  const transfer = optimizeSplit(i.transferTable, send, i.opts)
  if (!transfer.ok) return transfer
  return { ok: true, send, transfer, withdrawal, total: transfer.total + withdrawal.total }
}

export type MaxResult = { ok: true; amount: number; withdrawal: SplitOk; remaining: number } | Fail

/** Largest M (multiple of step) with M + optimal withdrawal cost ≤ balance (spec §5.3). */
export function maxWithdrawable(table: FeeTable, balance: number, opts: SplitOpts): MaxResult {
  if (!Number.isFinite(balance) || balance <= 0 || !(opts.step > 0)) return { ok: false, reason: 'invalid_amount' }
  const step = opts.step
  const eval_ = (m: number): SplitOk | null => {
    const r = optimizeSplit(table, m, opts)
    return r.ok && m + r.total <= balance ? r : null
  }
  if (!table.length) return { ok: false, reason: 'unavailable' }
  // Every valid M satisfies M ≤ balance − minFee, so scanning down from there, the first fit is the largest.
  const minFee = Math.min(...table.map((t) => ('fee' in t ? t.fee : Math.ceil((Math.max(t.min, 1) * t.feePercent) / 100))))
  const lo = Math.ceil(Math.max(opts.minTx, 1) / step) * step
  // Upper bound is min(balance − minFee, max splittable); subtracting minFee from the cap as well would miss M = cap.
  const top = Math.min(balance - minFee, opts.maxTx * opts.maxTxAmount)
  let best = 0
  let w: SplitOk | null = null
  for (let m = Math.floor(top / step) * step; m >= lo; m -= step) {
    w = eval_(m)
    if (w) {
      best = m
      break
    }
  }
  if (!best || !w) return { ok: false, reason: 'insufficient' }
  return { ok: true, amount: best, withdrawal: w, remaining: balance - best - w.total }
}
