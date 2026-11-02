import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { inverse, maxWithdrawable } from '../../src/engine/inverse'
import { optimizeSplit } from '../../src/engine/optimize'
import type { SplitOpts } from '../../src/engine/types'
import type { FeeTable, Tariffs } from '../../src/tariffs/schema'

const tariffs: Tariffs = JSON.parse(readFileSync('tests/fixtures/tarifs.snapshot.json', 'utf8'))
const mv = tariffs.operators.mvola.fees
const opts = { step: 1000, maxTx: 5, minTx: 100, maxTxAmount: 20000000 }

describe('inverse', () => {
  it('MVola→MVola net 100 000, withdrawal fee included', () => {
    const r = inverse({ net: 100000, withdrawTable: mv.withdrawal!, transferTable: mv.transfer_same!, includeWithdrawalFee: true, opts })
    if (!r.ok) throw new Error(r.reason)
    expect(r.withdrawal.total).toBe(1900)
    expect(r.send).toBe(101900)
    // Single transfer of 101 900 costs 1 900 (brief: total 3 800 with maxTx 1);
    // the optimal split 100 000 + 1 900 costs 1 000 + 70 = 1 070.
    expect(r.transfer.single).toBe(1900)
    expect(r.transfer.total).toBe(1070)
    expect(r.total).toBe(2970)
  })
  it('single-transaction mode reproduces brief total 3 800', () => {
    const r = inverse({ net: 100000, withdrawTable: mv.withdrawal!, transferTable: mv.transfer_same!, includeWithdrawalFee: true, opts: { ...opts, maxTx: 1 } })
    if (!r.ok) throw new Error(r.reason)
    expect(r.send).toBe(101900)
    expect(r.total).toBe(3800)
  })
  it('without withdrawal fee included', () => {
    const r = inverse({ net: 100000, withdrawTable: mv.withdrawal!, transferTable: mv.transfer_same!, includeWithdrawalFee: false, opts })
    if (!r.ok) throw new Error(r.reason)
    const tr = optimizeSplit(mv.transfer_same!, 100000, opts)
    if (!tr.ok) throw new Error(tr.reason)
    expect(r.send).toBe(100000)
    expect(r.total).toBe(tr.total + 1900)
  })
  it('propagates unavailable withdrawal', () => {
    const r = inverse({ net: 100000, withdrawTable: [], transferTable: mv.transfer_same!, includeWithdrawalFee: true, opts })
    expect(r).toEqual({ ok: false, reason: 'unavailable' })
  })
  it('withdrawOpts applies the withdrawing operator minTx (Orange 200)', () => {
    const base = { net: 150, withdrawTable: mv.withdrawal!, transferTable: mv.transfer_same!, includeWithdrawalFee: true, opts: { ...opts, step: 50 } }
    expect(inverse({ ...base, withdrawOpts: { ...opts, step: 50, minTx: 200 } })).toEqual({ ok: false, reason: 'below_min' })
    expect(inverse(base).ok).toBe(true)
  })
  it('propagates invalid input without throwing', () => {
    expect(inverse({ net: -5, withdrawTable: mv.withdrawal!, transferTable: mv.transfer_same!, includeWithdrawalFee: true, opts }).ok).toBe(false)
  })
})

describe('maxWithdrawable', () => {
  const fits = (m: number, bal: number) => {
    const r = optimizeSplit(mv.withdrawal!, m, opts)
    return r.ok && m + r.total <= bal
  }
  it('487 350 step 1000 matches linear search', () => {
    const r = maxWithdrawable(mv.withdrawal!, 487350, opts)
    if (!r.ok) throw new Error(r.reason)
    expect(r.amount + r.withdrawal.total).toBeLessThanOrEqual(487350)
    expect(r.remaining).toBe(487350 - r.amount - r.withdrawal.total)
    expect(fits(r.amount + 1000, 487350)).toBe(false)
    let lin = 0
    for (let m = 1000; m <= 487350; m += 1000) if (fits(m, 487350)) lin = m
    expect(r.amount).toBe(lin)
  })
  it('150 step 100 → insufficient', () => {
    expect(maxWithdrawable(mv.withdrawal!, 150, { ...opts, step: 100 })).toEqual({ ok: false, reason: 'insufficient' })
  })
  it('invalid balance does not throw', () => {
    expect(maxWithdrawable(mv.withdrawal!, NaN, opts).ok).toBe(false)
  })
})

const linear = (table: FeeTable, bal: number, o: SplitOpts) => {
  let best = 0
  for (let m = Math.ceil(o.minTx / o.step) * o.step; m <= bal; m += o.step) {
    const r = optimizeSplit(table, m, o)
    if (r.ok && m + r.total <= bal) best = m
  }
  return best
}
const check = (table: FeeTable, bal: number, o: SplitOpts) => {
  const r = maxWithdrawable(table, bal, o)
  const lin = linear(table, bal, o)
  if (lin === 0) expect(r.ok).toBe(false)
  else expect(r.ok && r.amount).toBe(lin)
}

describe('maxWithdrawable brute force', () => {
  const ops = ['mvola', 'airtel', 'orange'] as const
  for (const id of ops) {
    it(`${id} withdrawal`, () => {
      const op = tariffs.operators[id]
      for (const step of [100, 500, 1000]) {
        const o = { step, maxTx: 3, minTx: op.limits.minTx, maxTxAmount: op.limits.maxTx }
        for (const bal of [150, 999, 5300, 26100, 51234, 101900, 254000]) check(op.fees.withdrawal!, bal, o)
      }
    })
  }
  const pct: FeeTable = [
    { min: 100, max: 1000, fee: 100 },
    { min: 1001, max: 10000, feePercent: 50 },
    { min: 10001, max: 1000000, fee: 500 },
  ]
  it('percent tier: balance 11 600 step 1000 → 11 000', () => {
    const o = { step: 1000, maxTx: 3, minTx: 100, maxTxAmount: 1000000 }
    const r = maxWithdrawable(pct, 11600, o)
    expect(r.ok && r.amount).toBe(11000)
    for (const step of [100, 1000]) for (const bal of [300, 2500, 9000, 11600, 15000]) check(pct, bal, { ...o, step })
  })
  it('non-monotone fixed table, maxTx 1', () => {
    const nm: FeeTable = [
      { min: 100, max: 1000, fee: 100 },
      { min: 1001, max: 5000, fee: 2000 },
      { min: 5001, max: 10000, fee: 200 },
    ]
    const o = { step: 100, maxTx: 1, minTx: 100, maxTxAmount: 10000 }
    expect(maxWithdrawable(nm, 5300, o)).toMatchObject({ ok: true, amount: 5100 })
    for (const bal of [150, 1200, 3000, 5300, 7000, 10200, 12000]) check(nm, bal, o)
  })
  it('20 M balance is fast', () => {
    const t0 = performance.now()
    const r = maxWithdrawable(mv.withdrawal!, 20000000, opts)
    expect(r.ok).toBe(true)
    expect(performance.now() - t0).toBeLessThan(200)
  })
})
