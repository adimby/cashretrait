import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { sendPaths } from '../../src/engine/paths'
import { optimizeSplit } from '../../src/engine/optimize'
import { feeFor } from '../../src/engine/fees'
import type { Tariffs } from '../../src/tariffs/schema'

const t: Tariffs = JSON.parse(readFileSync('public/tarifs.json', 'utf8'))
const o = { step: 1000, maxTx: 5 }
const lim = (id: 'mvola' | 'airtel' | 'orange') => ({ ...o, minTx: t.operators[id].limits.minTx, maxTxAmount: t.operators[id].limits.maxTx })
const sorted = (xs: number[]) => xs.every((x, i) => i === 0 || xs[i - 1] <= x)
const totals = (ps: ReturnType<typeof sendPaths>) => ps.map((p) => (p.result.ok ? p.result.total : NaN))

describe('sendPaths', () => {
  it('MVola→Airtel other_op', () => {
    const ps = sendPaths(t, 'mvola', 'airtel', 100000, true, o)
    const p = ps.find((x) => x.kind === 'other_op')!
    expect(p.to).toBe('airtel')
    const aw = optimizeSplit(t.operators.airtel.fees.withdrawal!, 100000, lim('airtel'))
    if (!aw.ok) throw new Error()
    expect(aw.total).toBe(feeFor(t.operators.airtel.fees.withdrawal!, 100000))
    const tr = optimizeSplit(t.operators.mvola.fees.transfer_other_op!, 100000 + aw.total, lim('mvola'))
    if (!tr.ok || !p.result.ok) throw new Error()
    expect(p.result.send).toBe(100000 + aw.total)
    expect(p.result.total).toBe(tr.total + aw.total)
    expect(sorted(totals(ps))).toBe(true)
    expect(ps.every((x) => x.result.ok)).toBe(true)
  })
  it('Orange→Orange has same and same_app, same_app cheaper', () => {
    const ps = sendPaths(t, 'orange', 'orange', 100000, true, o)
    const same = ps.find((x) => x.kind === 'same')!
    const app = ps.find((x) => x.kind === 'same_app')!
    if (!same.result.ok || !app.result.ok) throw new Error()
    expect(app.result.total).toBeLessThan(same.result.total)
  })
  it('to=null enumerates all destinations, sorted', () => {
    const ps = sendPaths(t, 'mvola', null, 100000, true, o)
    expect(ps.some((p) => p.kind === 'same' && p.to === 'mvola')).toBe(true)
    expect(ps.some((p) => p.kind === 'other_op' && p.to === 'airtel')).toBe(true)
    expect(ps.some((p) => p.kind === 'other_op' && p.to === 'orange')).toBe(true)
    expect(ps.some((p) => p.kind === 'non_customer' && p.to === null)).toBe(true)
    expect(sorted(totals(ps))).toBe(true)
  })
  it('Orange has no non_customer path (no withdrawal_non_customer)', () => {
    const ps = sendPaths(t, 'orange', null, 100000, true, o)
    expect(ps.length).toBeGreaterThan(0)
    expect(ps.some((p) => p.kind === 'non_customer')).toBe(false)
  })
  it('invalid amount → empty list, no throw', () => {
    expect(sendPaths(t, 'mvola', 'airtel', -3, true, o)).toEqual([])
  })
})
