import type { FeeTable } from '../tariffs/schema'
import { feeFor } from './fees'

export type Hint = { amount: number; fee: number; currentFee: number }

/** Suggest a slightly lower amount just under a tier ceiling that saves ≥ 20 % (spec §5.4). */
export function tierHint(table: FeeTable, amount: number, step: number): Hint | null {
  if (!Number.isFinite(amount) || amount <= 0 || !(step > 0)) return null
  const currentFee = feeFor(table, amount)
  if (currentFee === null) return null
  const slack = Math.max(0.02 * amount, step)
  let best: Hint | null = null
  for (const tier of table) {
    const c = Math.floor(tier.max / step) * step
    if (c <= 0 || c >= amount || amount - c > slack) continue
    const fee = feeFor(table, c)
    if (fee === null || fee >= currentFee || fee > 0.8 * currentFee) continue
    if (!best || c > best.amount) best = { amount: c, fee, currentFee }
  }
  return best
}
