import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { TariffsSchema } from '../../src/tariffs/schema'

const raw = JSON.parse(readFileSync('public/tarifs.json', 'utf8'))
const bad = (tier: unknown) => {
  const t = structuredClone(raw)
  t.operators.mvola.fees.withdrawal = [tier]
  return TariffsSchema.safeParse(t).success
}

describe('tariffs schema', () => {
  it('parses public/tarifs.json', () => {
    expect(() => TariffsSchema.parse(raw)).not.toThrow()
  })
  it('rejects min > max', () => expect(bad({ min: 1000, max: 100, fee: 5 })).toBe(false))
  it('rejects negative fee', () => expect(bad({ min: 1, max: 100, fee: -5 })).toBe(false))
  it('rejects tier without fee/feePercent', () => expect(bad({ min: 1, max: 100 })).toBe(false))
  it('control values', () => {
    const o = TariffsSchema.parse(raw).operators
    expect(o.mvola.fees.withdrawal).toContainEqual({ min: 1000001, max: 2000000, fee: 14700 })
    expect(o.airtel.fees.transfer_same).toContainEqual({ min: 1001, max: 5000, fee: 65 })
    expect(o.orange.fees.withdrawal![0]).toEqual({ min: 200, max: 1000, fee: 100 })
    expect(o.orange.fees.transfer_non_customer).toContainEqual({ min: 9000001, max: 10000000, fee: 58000 })
  })
})
