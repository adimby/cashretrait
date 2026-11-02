import { signal, type Signal } from '@preact/signals'
import type { Usage } from '../../engine/monthly'
import { readJson, writeJson } from './storage'

/** A usage being edited: the amount may still be empty. */
export type UsageDraft = Omit<Usage, 'amount'> & { amount: number | null }

export const USAGES_KEY = 'cr.usages'
export const USAGE_OPS: readonly Usage['operation'][] = ['withdrawal', 'transfer_same', 'transfer_other_op']
export const MAX_USAGES = 6
export const PER_MONTH_MAX = 60
export const DEFAULT_USAGES: UsageDraft[] = [{ operation: 'withdrawal', amount: 50000, perMonth: 4 }]

function sanitize(raw: unknown): UsageDraft[] {
  if (!Array.isArray(raw)) return DEFAULT_USAGES
  return raw.filter((u): u is UsageDraft => {
    if (!u || typeof u !== 'object') return false
    const o = u as Record<string, unknown>
    return USAGE_OPS.includes(o.operation as Usage['operation'])
      && (o.amount === null || (Number.isInteger(o.amount) && (o.amount as number) > 0))
      && Number.isInteger(o.perMonth) && (o.perMonth as number) >= 0 && (o.perMonth as number) <= PER_MONTH_MAX
  }).map((u) => ({ operation: u.operation, amount: u.amount, perMonth: u.perMonth })).slice(0, MAX_USAGES)
}

/** Usual monthly usages for Comparer (localStorage 'cr.usages'). */
export const usages: Signal<UsageDraft[]> = signal(sanitize(readJson(USAGES_KEY)))

export function setUsages(next: UsageDraft[]): void {
  usages.value = next
  writeJson(USAGES_KEY, next)
}
