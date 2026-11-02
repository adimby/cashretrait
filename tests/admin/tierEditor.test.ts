import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { addTier, applyEdit, gitBlobSha, mapGenericTable, parseAmount, removeTier, setKind } from '../../src/admin/tiers'
import { mergeOperator, validateTariffs } from '../../src/tariffs/validate'
import type { FeeTable, Tariffs } from '../../src/tariffs/schema'

const tariffs = (): Tariffs => JSON.parse(readFileSync(new URL('../../public/tarifs.json', import.meta.url), 'utf8'))
const table: FeeTable = [
  { min: 100, max: 1000, fee: 50 },
  { min: 1001, max: 5000, fee: 100 },
  { min: 5001, max: 10000, feePercent: 1.5 },
]

describe('applyEdit', () => {
  it('changes only the targeted field and returns a new table', () => {
    const before = structuredClone(table)
    const out = applyEdit(table, 1, 'fee', 150)
    expect(out).not.toBe(table)
    expect(out[1]).not.toBe(table[1])
    expect(out[1]).toEqual({ min: 1001, max: 5000, fee: 150 })
    expect(out[0]).toBe(table[0])
    expect(out[2]).toBe(table[2])
    expect(table).toEqual(before)
  })
  it('edits min and max independently', () => {
    expect(applyEdit(table, 0, 'min', 1)[0]).toEqual({ min: 1, max: 1000, fee: 50 })
    expect(applyEdit(table, 0, 'max', 999)[0]).toEqual({ min: 100, max: 999, fee: 50 })
  })
  it("'fee' on a percentage tier sets the percentage (the tier's fee value)", () => {
    expect(applyEdit(table, 2, 'fee', 2)[2]).toEqual({ min: 5001, max: 10000, feePercent: 2 })
  })
  it('out-of-range index → same content, new array', () => {
    const out = applyEdit(table, 9, 'fee', 1)
    expect(out).toEqual(table)
    expect(out).not.toBe(table)
  })
  it('an edit that opens a gap makes validateTariffs invalid', () => {
    const t = tariffs()
    const op = t.operators.mvola
    const wd = op.fees.withdrawal!
    expect(validateTariffs(t, t).status).not.toBe('invalid')
    const edited = applyEdit(wd, 0, 'max', wd[0].max - 1)
    const next = mergeOperator(t, 'mvola', { ...op, fees: { ...op.fees, withdrawal: edited } })
    const v = validateTariffs(next, t)
    expect(v.status).toBe('invalid')
    expect(v.reasons.join('\n')).toMatch(/non contigu/)
  })
})

describe('row helpers', () => {
  it('setKind switches fee ↔ percentage keeping the value', () => {
    expect(setKind(table, 0, 'pct')[0]).toEqual({ min: 100, max: 1000, feePercent: 50 })
    expect(setKind(table, 2, 'fee')[2]).toEqual({ min: 5001, max: 10000, fee: 1.5 })
    expect(setKind(table, 0, 'fee')[0]).toBe(table[0])
  })
  it('addTier appends a contiguous tier; removeTier drops one', () => {
    expect(addTier(table, 100).at(-1)).toEqual({ min: 10001, max: 10001, fee: 0 })
    expect(addTier([], 100)).toEqual([{ min: 100, max: 100, fee: 0 }])
    expect(removeTier(table, 1)).toEqual([table[0], table[2]])
  })
})

describe('parseAmount', () => {
  it('accepts spaces, nbsp, dots as thousands separators and Ar', () => {
    expect(parseAmount('1 000 000')).toBe(1000000)
    expect(parseAmount('1 000 Ar')).toBe(1000)
    expect(parseAmount('25.000')).toBe(25000)
    expect(parseAmount('1,5 %')).toBe(1.5)
    expect(parseAmount('1.5%')).toBe(1.5)
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
  })
})

describe('mapGenericTable', () => {
  it('maps a range column + fee column', () => {
    const g = { headers: ['Montant', 'Frais'], rows: [['100 - 1 000', '50'], ['1 001 à 5 000', '100 Ar'], ['5 001 – 10 000', '1,5 %'], ['Total', '']] }
    expect(mapGenericTable(g, { range: 0, fee: 1 })).toEqual([
      { min: 100, max: 1000, fee: 50 },
      { min: 1001, max: 5000, fee: 100 },
      { min: 5001, max: 10000, feePercent: 1.5 },
    ])
  })
  it('maps separate min / max columns', () => {
    const g = { headers: ['De', 'À', 'Frais'], rows: [['100', '1 000', '50'], ['1 001', '5 000', '100']] }
    expect(mapGenericTable(g, { min: 0, max: 1, fee: 2 })).toEqual([
      { min: 100, max: 1000, fee: 50 },
      { min: 1001, max: 5000, fee: 100 },
    ])
  })
})

describe('gitBlobSha', () => {
  it('matches git hash-object', async () => {
    expect(await gitBlobSha('hello\n')).toBe('ce013625030ba8dba906f756967f9e9ca394464a')
    expect(await gitBlobSha('é')).toBe('4b04fff51468d8ab5201ab02b725dc477bc7cb45') // byte length, not char length
  })
})
