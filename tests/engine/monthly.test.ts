import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { monthlyCost } from '../../src/engine/monthly'
import { optimizeSplit } from '../../src/engine/optimize'
import { OPERATORS, type Tariffs } from '../../src/tariffs/schema'

const t: Tariffs = JSON.parse(readFileSync('public/tarifs.json', 'utf8'))
const o = { step: 1000, maxTx: 5 }

describe('monthlyCost', () => {
  it('4 × withdrawal 200 000', () => {
    const r = monthlyCost(t, [{ operation: 'withdrawal', amount: 200000, perMonth: 4 }], o)
    if (!Array.isArray(r)) throw new Error(r.reason)
    expect(r).toHaveLength(3)
    for (const id of OPERATORS) {
      const op = t.operators[id]
      const s = optimizeSplit(op.fees.withdrawal!, 200000, { ...o, minTx: op.limits.minTx, maxTxAmount: op.limits.maxTx })
      if (!s.ok) throw new Error()
      expect(r.find((x) => x.operator === id)!.total).toBe(4 * s.total)
    }
    const ts = r.map((x) => x.total!)
    expect(ts).toEqual([...ts].sort((a, b) => a - b))
  })
  it('unavailable operation → null, last', () => {
    const t2: Tariffs = structuredClone(t)
    delete t2.operators.airtel.fees.withdrawal
    const r = monthlyCost(t2, [{ operation: 'withdrawal', amount: 200000, perMonth: 4 }], o)
    if (!Array.isArray(r)) throw new Error(r.reason)
    expect(r[2]).toEqual({ operator: 'airtel', total: null })
  })
  it('invalid usages → invalid_amount', () => {
    for (const u of [{ amount: 0, perMonth: 1 }, { amount: 1.5, perMonth: 1 }, { amount: 1000, perMonth: -1 }, { amount: 1000, perMonth: 0.5 }]) {
      expect(monthlyCost(t, [{ operation: 'withdrawal', ...u }], o)).toEqual({ ok: false, reason: 'invalid_amount' })
    }
  })
})
