import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { TariffsSchema } from '../../src/tariffs/schema'
import { optimizeSplit } from '../../src/engine/optimize'
import { inverse, maxWithdrawable } from '../../src/engine/inverse'
import { optsFor } from '../../src/engine/limits'
import { shareText, share, shareDetailed } from '../../src/ui/share'
import { formatAr } from '../../src/ui/format'
import type { SplitOk } from '../../src/engine/types'

const T = TariffsSchema.parse(JSON.parse(readFileSync('tests/fixtures/tarifs.snapshot.json', 'utf8')))
const mv = T.operators.mvola.fees
const opts1 = optsFor(T, 'mvola', { step: 1, maxTx: 5 })
const ar = (n: string) => n.replace(/ /g, ' ') + ' Ar'

describe('shareText', () => {
  it('withdraw 1 000 001 MVola (step 1): amounts actually produced, total, savings, indicative note', () => {
    const r = optimizeSplit(mv.withdrawal!, 1000001, opts1) as SplitOk
    expect(r.ok).toBe(true)
    // Not [1 000 000, 1]: 1 Ar is below MVola's minimum transaction (100 Ar).
    expect(r.transactions).toHaveLength(2)
    expect(r.total).toBe(8900)
    expect(r.transactions.every((x) => x.amount >= 100)).toBe(true)
    const s = shareText('withdraw', r, 'fr', { op: 'mvola' })
    expect(s).toContain(ar('1 000 001'))
    for (const x of r.transactions) expect(s).toContain(formatAr(x.amount))
    expect(s).not.toContain('(frais 0')
    expect(s).toContain(ar('8 900'))
    expect(s).toContain(ar('5 800')) // savings vs 14 700 in one go
    expect(s).toContain('MVola')
    expect(s).toContain('Calcul indicatif')
    expect(s).not.toMatch(/\*\d|#\s*$|tel:/m)
  })
  it('is translated in mg', () => {
    const r = optimizeSplit(mv.withdrawal!, 1000001, opts1) as SplitOk
    const fr = shareText('withdraw', r, 'fr')
    const mg = shareText('withdraw', r, 'mg')
    expect(mg).not.toBe(fr)
    expect(mg).toContain(ar('8 900'))
  })
  it('receive: send amount, both splits and total', () => {
    const r = inverse({ net: 100000, withdrawTable: mv.withdrawal!, transferTable: mv.transfer_same!, includeWithdrawalFee: true, opts: optsFor(T, 'mvola', { step: 100, maxTx: 5 }) })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const s = shareText('receive', r, 'fr')
    expect(s).toContain(ar('100 000'))
    expect(s).toContain(ar(String(r.send).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')))
    expect(s).toContain('Calcul indicatif')
  })
  it('receive, withdrawal fee not included: fee as information, only what the recipient can take out', () => {
    const o = optsFor(T, 'mvola', { step: 1000, maxTx: 5 })
    const r = inverse({ net: 100000, withdrawTable: mv.withdrawal!, transferTable: mv.transfer_same!, includeWithdrawalFee: false, opts: o })
    if (!r.ok || !r.takeOut || !r.takeOut.ok) throw new Error('expected a take-out')
    const s = shareText('receive', r, 'fr')
    // The full-net withdrawal (100 000, frais 1 900) is never listed as a transaction to do.
    expect(s).not.toContain(`${ar('100 000')} (frais ${ar('1 900')})`)
    expect(s).toContain(`Pour retirer ${ar('100 000')}, il lui faudrait aussi ${ar('1 900')} de frais`)
    expect(s).toContain(`Il peut retirer au plus ${ar('98 000')}`)
    expect(r.takeOut.amount + r.takeOut.withdrawal.total + r.takeOut.remaining).toBe(100000)
    expect(s).toContain(`Frais d'envoi : ${ar(String(r.transfer.total).replace(/\B(?=(\d{3})+(?!\d))/g, ' '))}`)
    expect(s).not.toContain('Il fait')
    expect(shareText('receive', r, 'mg')).toContain(ar('98 000'))
  })
  it('receive, fee not included, nothing withdrawable → says so', () => {
    const r = inverse({ net: 150, withdrawTable: mv.withdrawal!, transferTable: mv.transfer_same!, includeWithdrawalFee: false, opts: optsFor(T, 'mvola', { step: 100, maxTx: 5 }) })
    if (!r.ok) throw new Error(r.reason)
    expect(r.takeOut).toEqual({ ok: false, reason: 'insufficient' })
    expect(shareText('receive', r, 'fr')).toContain('il ne peut rien retirer')
  })
  it('max: amount and remaining balance', () => {
    const r = maxWithdrawable(mv.withdrawal!, 100000, optsFor(T, 'mvola', { step: 1000, maxTx: 5 }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const s = shareText('max', r, 'fr')
    expect(s).toContain(ar(String(r.amount).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')))
    expect(s).toContain(ar('100 000'))
  })
})

describe('share', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('without navigator.share copies to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await expect(share('hello')).resolves.toBe('copied')
    expect(writeText).toHaveBeenCalledWith('hello')
  })
  it('uses navigator.share when present', async () => {
    const s = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share: s, clipboard: { writeText: vi.fn() } })
    await expect(share('x')).resolves.toBe('shared')
    expect(s).toHaveBeenCalledWith({ text: 'x' })
  })
  it('falls back to clipboard when share throws (not a cancel)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(new Error('nope')), clipboard: { writeText } })
    await expect(share('x')).resolves.toBe('copied')
  })
  it('tells a closed share sheet from a real failure', async () => {
    const abort = Object.assign(new Error('closed'), { name: 'AbortError' })
    const writeText = vi.fn()
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(abort), clipboard: { writeText } })
    await expect(shareDetailed('x')).resolves.toBe('cancelled')
    await expect(share('x')).resolves.toBe('failed')
    expect(writeText).not.toHaveBeenCalled()
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(new Error('x')), clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    await expect(shareDetailed('x')).resolves.toBe('failed')
  })
  it('fails cleanly with nothing available', async () => {
    vi.stubGlobal('navigator', {})
    await expect(share('x')).resolves.toBe('failed')
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    await expect(share('x')).resolves.toBe('failed')
  })
})
