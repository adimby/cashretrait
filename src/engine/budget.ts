import type { FeeTable } from '../tariffs/schema'
import { maxWithdrawable } from './inverse'
import { optimizeSplit } from './optimize'
import type { SplitOk, SplitOpts } from './types'

export type SameBudget = {
  /** Withdrawing `amount` in a single transaction: what is debited from the account. */
  classic: { amount: number; fee: number; debited: number }
  /** The largest amount (multiple of step) whose optimal split fits within the same debit. */
  better: {
    amount: number
    withdrawal: SplitOk
    debited: number
    /** better.amount − classic.amount: the extra cash in hand for the same budget (> 0). */
    extra: number
    /** classic.debited − better.debited: what stays on the account (≥ 0). */
    left: number
  }
}

/**
 * « Same budget, more cash »: the one-go withdrawal of `amount` costs `amount + fee`; with that
 * very debit, how much can be taken out by splitting? Uses maxWithdrawable (exact) with the
 * one-go debit as balance. Null when the one-go withdrawal is impossible, or when splitting does
 * not give strictly more cash (free withdrawal, maxTx = 1, no cheaper combination…).
 */
export function sameBudget(table: FeeTable, amount: number, opts: SplitOpts): SameBudget | null {
  const one = optimizeSplit(table, amount, { ...opts, maxTx: 1 })
  if (!one.ok) return null
  const debited = amount + one.total
  const m = maxWithdrawable(table, debited, opts)
  if (!m.ok || m.amount <= amount) return null
  const spent = m.amount + m.withdrawal.total
  return {
    classic: { amount, fee: one.total, debited },
    better: { amount: m.amount, withdrawal: m.withdrawal, debited: spent, extra: m.amount - amount, left: debited - spent },
  }
}
