import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { sameBudget } from '../../src/engine/budget'
import { optimizeSplit } from '../../src/engine/optimize'
import type { SplitOpts } from '../../src/engine/types'
import type { FeeTable, Tariffs } from '../../src/tariffs/schema'

const tariffs: Tariffs = JSON.parse(readFileSync('tests/fixtures/tarifs.snapshot.json', 'utf8'))
const mv = tariffs.operators.mvola.fees
const opts: SplitOpts = { step: 1000, maxTx: 5, minTx: 100, maxTxAmount: 20000000 }

/** Independent reference: largest multiple of step whose optimal withdrawal fits the one-go budget. */
const reference = (table: FeeTable, amount: number, o: SplitOpts): number | null => {
  const one = optimizeSplit(table, amount, { ...o, maxTx: 1 })
  if (!one.ok) return null
  const budget = amount + one.total
  let best = 0
  for (let m = Math.ceil(o.minTx / o.step) * o.step; m <= budget; m += o.step) {
    const r = optimizeSplit(table, m, o)
    if (r.ok && m + r.total <= budget) best = m
  }
  return best > amount ? best : null
}

describe('sameBudget', () => {
  it('MVola 540 000: the one-go cost (548 800) withdraws 542 000 when split', () => {
    const r = sameBudget(mv.withdrawal!, 540000, opts)
    expect(r).not.toBeNull()
    expect(r!.classic).toEqual({ amount: 540000, fee: 8800, debited: 548800 })
    expect(r!.better.amount).toBe(542000)
    expect(r!.better.withdrawal.total).toBe(5900)
    expect(r!.better.withdrawal.transactions.map((x) => x.amount)).toEqual([500000, 25000, 17000])
    expect(r!.better.debited).toBe(547900)
    expect(r!.better.extra).toBe(2000)
    expect(r!.better.left).toBe(900)
  })

  it('never debits more than the one-go withdrawal', () => {
    for (const amount of [12000, 26000, 99000, 260000, 540000, 1000001, 3500000]) {
      const r = sameBudget(mv.withdrawal!, amount, opts)
      if (!r) continue
      expect(r.better.debited).toBeLessThanOrEqual(r.classic.debited)
      expect(r.better.amount).toBeGreaterThan(amount)
      expect(r.better.debited + r.better.left).toBe(r.classic.debited)
    }
  })

  it('matches an exhaustive search (MVola, Airtel, Orange; steps 100 and 1000; maxTx 3 and 5)', () => {
    for (const id of ['mvola', 'airtel', 'orange'] as const) {
      const table = tariffs.operators[id].fees.withdrawal!
      const minTx = tariffs.operators[id].limits.minTx
      for (const o of [{ ...opts, minTx, step: 1000, maxTx: 5 }, { ...opts, minTx, step: 100, maxTx: 3 }]) {
        for (const amount of [5000, 20500, 26000, 51000, 99000, 101000, 251000, 540000]) {
          const r = sameBudget(table, amount, o)
          expect(r ? r.better.amount : null, `${id} ${amount} step ${o.step} maxTx ${o.maxTx}`).toBe(reference(table, amount, o))
        }
      }
    }
  })

  it('a non-multiple amount still compares with the exact one-go cost', () => {
    const r = sameBudget(mv.withdrawal!, 540550, opts)
    // 540 550 in one go costs 8 800 → budget 549 350.
    expect(r!.classic.debited).toBe(549350)
    expect(r!.better.amount % 1000).toBe(0)
    expect(r!.better.amount).toBeGreaterThan(540550)
  })

  it('no card when nothing more can be taken out', () => {
    // Free withdrawal (MVola without account): the budget equals the amount.
    expect(sameBudget(mv.withdrawal_non_customer!, 540000, opts)).toBeNull()
    // One transaction allowed: the best is the classic withdrawal itself.
    expect(sameBudget(mv.withdrawal!, 540000, { ...opts, maxTx: 1 })).toBeNull()
  })

  it('no card when the one-go withdrawal itself is impossible or the input is invalid', () => {
    expect(sameBudget(mv.withdrawal!, 25000000, opts)).toBeNull() // above the per-transaction cap
    expect(sameBudget(mv.withdrawal!, 50, opts)).toBeNull() // below the minimum
    expect(sameBudget(mv.withdrawal!, 0, opts)).toBeNull()
    expect(sameBudget(mv.withdrawal!, 1.5, opts)).toBeNull()
    expect(sameBudget([], 540000, opts)).toBeNull()
  })
})
