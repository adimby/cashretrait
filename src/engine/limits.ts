import type { OperatorId, Tariffs } from '../tariffs/schema'
import type { SplitOpts } from './types'

export type BaseOpts = Omit<SplitOpts, 'minTx' | 'maxTxAmount'>

/** SplitOpts completed with an operator's own limits. */
export const optsFor = (t: Tariffs, id: OperatorId, o: BaseOpts): SplitOpts => ({
  ...o,
  minTx: t.operators[id].limits.minTx,
  maxTxAmount: t.operators[id].limits.maxTx,
})
