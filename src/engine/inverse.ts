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
  const lo0 = Math.ceil(Math.max(opts.minTx, 1) / step)
  const cap = Math.min(balance, opts.maxTx * opts.maxTxAmount)
  let lo = lo0
  let hi = Math.floor(cap / step)
  let found = 0
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (eval_(mid * step)) {
      found = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  // Cost is locally non-monotone: also try tier ceilings and steps up to the next ceiling.
  const bound = found ? found * step : lo0 * step
  const ceilings = table.map((t) => Math.floor(t.max / step) * step).filter((c) => c <= cap).sort((a, b) => a - b)
  const next = ceilings.find((c) => c > bound) ?? bound
  const tries = new Set<number>(ceilings.filter((c) => c > bound && c <= next))
  for (let m = bound + step; m <= Math.min(next, bound + 50 * step, cap); m += step) tries.add(m)
  let best = found ? found * step : 0
  for (const m of tries) if (m > best && m >= lo0 * step && eval_(m)) best = m
  if (!best) return { ok: false, reason: 'insufficient' }
  const w = eval_(best)!
  return { ok: true, amount: best, withdrawal: w, remaining: balance - best - w.total }
}
