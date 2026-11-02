import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { optimizeSplit } from '../../src/engine/optimize'
import type { SplitOk } from '../../src/engine/types'
import type { FeeTable, Tariffs } from '../../src/tariffs/schema'
import { bruteforce } from './bruteforce'

const tariffs: Tariffs = JSON.parse(readFileSync('public/tarifs.json', 'utf8'))
const t = tariffs.operators.mvola.fees.withdrawal!
const opts = { step: 1000, maxTx: 5, minTx: 100, maxTxAmount: 20000000 }
const sum = (r: SplitOk) => r.transactions.reduce((s, x) => s + x.amount, 0)
const ok = (r: ReturnType<typeof optimizeSplit>): SplitOk => {
  if (!r.ok) throw new Error(`expected ok, got ${r.reason}`)
  return r
}

describe('optimizeSplit', () => {
  it('1 000 001 with step 1 → 8 900 (single 14 700, savings 5 800)', () => {
    const r = ok(optimizeSplit(t, 1000001, { ...opts, step: 1 }))
    expect(r.total).toBe(8900)
    expect(r.single).toBe(14700)
    expect(r.savings).toBe(5800)
    expect(r.transactions).toHaveLength(2)
    expect(r.transactions[0].fee).toBe(8800)
    expect(r.transactions[1].fee).toBe(100)
    expect(sum(r)).toBe(1000001)
  })
  it('1 000 001 with step 1000 → remainder carries odd part, total 8 900', () => {
    const r = ok(optimizeSplit(t, 1000001, opts))
    expect(r.total).toBe(8900)
    expect(sum(r)).toBe(1000001)
  })
  it('sum of amounts equals request exactly (25 550)', () => {
    const r = ok(optimizeSplit(t, 25550, opts))
    expect(sum(r)).toBe(25550)
  })
  it('transactions sorted by decreasing amount', () => {
    const r = ok(optimizeSplit(t, 1000001, opts))
    const a = r.transactions.map((x) => x.amount)
    expect(a).toEqual([...a].sort((x, y) => y - x))
  })
  it('errors', () => {
    expect(optimizeSplit(t, 120000000, opts)).toEqual({ ok: false, reason: 'too_large' })
    expect(optimizeSplit(t, 50, opts)).toEqual({ ok: false, reason: 'below_min' })
    expect(optimizeSplit(t, 1.5, opts)).toEqual({ ok: false, reason: 'invalid_amount' })
    expect(optimizeSplit(t, 0, opts)).toEqual({ ok: false, reason: 'invalid_amount' })
    expect(optimizeSplit([], 1000, opts)).toEqual({ ok: false, reason: 'unavailable' })
  })
  it('maxTx 1 → single transaction, savings 0', () => {
    const r = ok(optimizeSplit(t, 1000001, { ...opts, maxTx: 1 }))
    expect(r.transactions).toHaveLength(1)
    expect(r.total).toBe(14700)
    expect(r.savings).toBe(0)
  })
  it('ties prefer fewer transactions', () => {
    const r = ok(optimizeSplit(t, 50000, opts))
    expect(r.transactions).toEqual([{ amount: 50000, fee: 1300 }])
  })
  it('performance: 19 999 000 in < 200 ms', () => {
    const t0 = performance.now()
    ok(optimizeSplit(t, 19999000, opts))
    expect(performance.now() - t0).toBeLessThan(200)
  })

  describe('matches brute force', () => {
    const synthetic: FeeTable = [
      { min: 100, max: 10000, fee: 200 },
      { min: 10001, max: 50000, feePercent: 1.5 },
      { min: 50001, max: 20000000, fee: 900 },
    ]
    const tables: [string, FeeTable][] = [['synthetic%', synthetic]]
    for (const op of ['mvola', 'airtel', 'orange'] as const) {
      for (const k of ['withdrawal', 'transfer_same'] as const) {
        tables.push([`${op}.${k}`, tariffs.operators[op].fees[k]!])
      }
    }
    for (const [name, table] of tables) {
      it(name, () => {
        const o = { step: 1000, maxTx: 4, minTx: 100, maxTxAmount: 20000000 }
        for (let a = 1000; a <= 120000; a += 1000) {
          const r = optimizeSplit(table, a, o)
          const b = bruteforce(table, a, 1000, 4, 100, 20000000)
          expect(r.ok ? r.total : null, `${name} @ ${a}`).toBe(b ? b.total : null)
        }
      })
    }
  })
})
