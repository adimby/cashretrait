import { OPERATORS, type OperatorId, type Tariffs } from '../tariffs/schema'
import { optsFor, type BaseOpts } from './limits'
import { optimizeSplit } from './optimize'
import type { Fail } from './types'

export type Usage = { operation: 'withdrawal' | 'transfer_same' | 'transfer_other_op'; amount: number; perMonth: number }
/** total is null when one of the usages is unavailable at that operator. */
export type MonthlyRow = { operator: OperatorId; total: number | null }
/** Rows sorted by total ascending, null last; or Fail for invalid usages. */
export type MonthlyResult = MonthlyRow[] | Fail

const validUsage = (u: Usage) =>
  Number.isInteger(u.amount) && u.amount > 0 && Number.isInteger(u.perMonth) && u.perMonth >= 0

/** Monthly cost per operator = Σ optimal cost × frequency (spec §5.4, F9). */
export function monthlyCost(t: Tariffs, usages: Usage[], opts: BaseOpts): MonthlyResult {
  if (!usages.every(validUsage)) return { ok: false, reason: 'invalid_amount' }
  const rows: MonthlyRow[] = OPERATORS.map((operator) => {
    let total: number | null = 0
    for (const u of usages) {
      const table = t.operators[operator].fees[u.operation]
      const r = table ? optimizeSplit(table, u.amount, optsFor(t, operator, opts)) : null
      if (!r || !r.ok) {
        total = null
        break
      }
      total += r.total * u.perMonth
    }
    return { operator, total }
  })
  return rows.sort((a, b) => (a.total === null ? 1 : 0) - (b.total === null ? 1 : 0) || (a.total ?? 0) - (b.total ?? 0))
}
