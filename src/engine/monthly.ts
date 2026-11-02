import { OPERATORS, type OperatorId, type Tariffs } from '../tariffs/schema'
import { optimizeSplit } from './optimize'
import { optsFor } from './paths'
import type { SplitOpts } from './types'

export type Usage = { operation: 'withdrawal' | 'transfer_same' | 'transfer_other_op'; amount: number; perMonth: number }

/** Monthly cost per operator = Σ optimal cost × frequency; null if any usage is unavailable (spec §5.4, F9). */
export function monthlyCost(
  t: Tariffs,
  usages: Usage[],
  opts: Omit<SplitOpts, 'minTx' | 'maxTxAmount'>,
): { operator: OperatorId; total: number | null }[] {
  const rows = OPERATORS.map((operator) => {
    let total: number | null = 0
    for (const u of usages) {
      const table = t.operators[operator].fees[u.operation]
      const r = table ? optimizeSplit(table, u.amount, optsFor(t, operator, opts)) : null
      if (!r || !r.ok || !Number.isFinite(u.perMonth) || u.perMonth < 0) {
        total = null
        break
      }
      total += r.total * u.perMonth
    }
    return { operator, total }
  })
  return rows.sort((a, b) => (a.total === null ? 1 : 0) - (b.total === null ? 1 : 0) || (a.total ?? 0) - (b.total ?? 0))
}
