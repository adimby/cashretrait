import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { TariffsSchema } from '../../src/tariffs/schema'
import { compute, formFrom, paramsOf, DEFAULT_FORM, type CalcForm } from '../../src/ui/calc'
import type { SplitOk } from '../../src/engine/types'

const T = TariffsSchema.parse(JSON.parse(readFileSync('public/tarifs.json', 'utf8')))
const base = { step: 1000 as const, maxTx: 5 }
const run = (p: Partial<CalcForm>) => compute(T, { ...DEFAULT_FORM, ...p }, base)

describe('compute', () => {
  it('empty without an amount', () => {
    expect(run({ amount: null }).status).toBe('empty')
  })
  it('withdraw: best split, chart on the withdrawal table', () => {
    const o = run({ amount: 260000 })
    expect(o.status).toBe('ok')
    if (o.status !== 'ok') return
    expect((o.best.result as SplitOk).total).toBe(3675)
    expect(o.chart?.key).toBe('withdrawal')
    expect(o.chart?.splits).toEqual([250000, 10000])
  })
  it('withdraw without account uses withdrawal_non_customer; Orange falls back to withdrawal', () => {
    const mv = run({ amount: 50000, customer: false })
    expect(mv.status === 'ok' && mv.chart?.key).toBe('withdrawal_non_customer')
    const om = run({ op: 'orange', amount: 50000, customer: false })
    expect(om.status === 'ok' && om.chart?.key).toBe('withdrawal')
  })
  it('fail reasons come from the engine', () => {
    expect(run({ amount: 50 })).toEqual({ status: 'fail', reason: 'below_min' })
    expect(run({ mode: 'send', op: 'airtel', to: 'none', amount: 10000 })).toEqual({ status: 'fail', reason: 'unavailable' })
    expect(run({ mode: 'max', amount: 100 })).toEqual({ status: 'fail', reason: 'insufficient' })
  })
  it('send Orange → Orange lists both variants, cheapest first', () => {
    const o = run({ mode: 'send', op: 'orange', to: 'orange', amount: 260000 })
    expect(o.status).toBe('ok')
    if (o.status !== 'ok') return
    expect([o.best.kind, ...o.alternatives.map((a) => a.kind)].sort()).toEqual(['same', 'same_app'])
    expect(o.alternatives.every((a) => a.total >= o.best.total)).toBe(true)
  })
  it('receive to any operator: sorted paths with alternatives', () => {
    const o = run({ mode: 'receive', to: 'any', amount: 100000 })
    expect(o.status).toBe('ok')
    if (o.status !== 'ok') return
    expect(o.alternatives.length).toBeGreaterThan(0)
    const totals = [o.best.total, ...o.alternatives.map((a) => a.total)]
    expect(totals).toEqual([...totals].sort((a, b) => a - b))
  })
  it('near-tier hint compares with the best split, not the one-go fee', () => {
    // 26 000: one go 1 300, best split 25 000 + 1 000 = 750, 25 000 alone 650 → under 20 %: quiet.
    const split = run({ amount: 26000 })
    expect(split.status === 'ok' && split.hint).toBe(null)
    // With one transaction allowed, the hint speaks.
    const one = compute(T, { ...DEFAULT_FORM, amount: 26000 }, { step: 1000, maxTx: 1 })
    expect(one.status === 'ok' && one.hint).toEqual({ amount: 25000, fee: 650, currentFee: 1300 })
    expect(run({ amount: 260000 }).status === 'ok' && (run({ amount: 260000 }) as { hint: unknown }).hint).toBe(null)
  })
  it('max: amount within balance', () => {
    const o = run({ mode: 'max', amount: 300000 })
    expect(o.status).toBe('ok')
    if (o.status !== 'ok' || !('amount' in o.best.result)) return
    expect(o.best.result.amount + o.best.result.withdrawal.total).toBeLessThanOrEqual(300000)
  })
})

describe('favorites ↔ form', () => {
  it('round-trips the fields of each mode', () => {
    const f: CalcForm = { mode: 'receive', op: 'airtel', to: 'any', amount: 75000, customer: true, incl: false }
    expect(formFrom('receive', paramsOf(f))).toEqual(f)
  })
  it('sanitises unexpected values', () => {
    const f = formFrom('send', { op: 'bank', to: 'x', amount: -3 })
    expect(f).toMatchObject({ op: 'mvola', to: 'mvola', amount: null })
  })
})
