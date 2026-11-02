import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { tierHint } from '../../src/engine/hints'
import type { Tariffs } from '../../src/tariffs/schema'

const t: Tariffs = JSON.parse(readFileSync('public/tarifs.json', 'utf8'))
const w = t.operators.mvola.fees.withdrawal!

describe('tierHint', () => {
  it('25 500 → suggest 25 000', () => {
    expect(tierHint(w, 25500, 500)).toEqual({ amount: 25000, fee: 650, currentFee: 1300 })
  })
  it('30 000 → null', () => expect(tierHint(w, 30000, 1000)).toBeNull())
  it('no zero-saving hint when current fee is 0', () => {
    const free = [{ min: 100, max: 1000, fee: 0 }, { min: 1001, max: 5000, fee: 0 }]
    expect(tierHint(free, 1010, 100)).toBeNull()
  })
  it('invalid input → null', () => {
    expect(tierHint(w, -1, 500)).toBeNull()
    expect(tierHint([], 25500, 500)).toBeNull()
  })
})
