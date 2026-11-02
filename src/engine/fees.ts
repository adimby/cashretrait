import type { FeeTable } from '../tariffs/schema'

/** Fee for a single transaction of `amount`, or null if no tier covers it. */
export function feeFor(table: FeeTable, amount: number): number | null {
  for (const tier of table) {
    if (amount >= tier.min && amount <= tier.max) {
      return 'fee' in tier ? tier.fee : Math.ceil((amount * tier.feePercent) / 100)
    }
  }
  return null
}
