import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { feeFor } from '../../src/engine/fees'
import type { Tariffs } from '../../src/tariffs/schema'

const tariffs: Tariffs = JSON.parse(readFileSync('tests/fixtures/tarifs.snapshot.json', 'utf8'))
const t = tariffs.operators.mvola.fees.withdrawal!

describe('feeFor', () => {
  it('uses MVola withdrawal tiers', () => {
    expect(feeFor(t, 1000)).toBe(100)
    expect(feeFor(t, 1001)).toBe(150)
  })
  it('returns null outside the table', () => {
    expect(feeFor(t, 99)).toBeNull()
    expect(feeFor(t, 20000001)).toBeNull()
  })
  it('rounds percent fees up', () => {
    expect(feeFor([{ min: 1, max: 100, feePercent: 1 }], 50)).toBe(1)
  })
  it('returns null for an empty table', () => {
    expect(feeFor([], 1000)).toBeNull()
  })
})
