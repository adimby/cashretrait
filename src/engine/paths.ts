import { OPERATORS, type FeeTable, type OperatorId, type Tariffs } from '../tariffs/schema'
import { inverse, type InverseResult } from './inverse'
import type { SplitOpts } from './types'

export type PathKind = 'same' | 'same_app' | 'other_op' | 'non_customer'
export type SendPath = { kind: PathKind; from: OperatorId; to: OperatorId | null; result: InverseResult }
type BaseOpts = Omit<SplitOpts, 'minTx' | 'maxTxAmount'>

export const optsFor = (t: Tariffs, id: OperatorId, o: BaseOpts): SplitOpts => ({
  ...o,
  minTx: t.operators[id].limits.minTx,
  maxTxAmount: t.operators[id].limits.maxTx,
})

/** Available send paths from `from` (to a given operator, or all if null), cheapest first (spec §5.4). */
export function sendPaths(
  t: Tariffs,
  from: OperatorId,
  to: OperatorId | null,
  net: number,
  includeWithdrawalFee: boolean,
  opts: BaseOpts,
): SendPath[] {
  const f = t.operators[from].fees
  const out: SendPath[] = []
  const add = (kind: PathKind, dest: OperatorId | null, transfer?: FeeTable, withdraw?: FeeTable) => {
    if (!transfer || !withdraw) return
    const result = inverse({
      net,
      transferTable: transfer,
      withdrawTable: withdraw,
      includeWithdrawalFee,
      opts: optsFor(t, from, opts),
      withdrawOpts: optsFor(t, dest ?? from, opts),
    })
    if (result.ok) out.push({ kind, from, to: dest, result })
  }
  const dests = to === null ? OPERATORS : [to]
  for (const d of dests) {
    if (d === from) {
      add('same', d, f.transfer_same, f.withdrawal)
      add('same_app', d, f.transfer_same_app, f.withdrawal)
    } else {
      add('other_op', d, f.transfer_other_op, t.operators[d].fees.withdrawal)
    }
  }
  add('non_customer', null, f.transfer_non_customer, f.withdrawal_non_customer)
  const total = (p: SendPath) => (p.result.ok ? p.result.total : Infinity)
  return out.sort((a, b) => total(a) - total(b))
}
