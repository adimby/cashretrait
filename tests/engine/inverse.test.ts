import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { inverse, maxWithdrawable } from '../../src/engine/inverse'
import { optimizeSplit } from '../../src/engine/optimize'
import type { Tariffs } from '../../src/tariffs/schema'

const tariffs: Tariffs = JSON.parse(readFileSync('public/tarifs.json', 'utf8'))
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
