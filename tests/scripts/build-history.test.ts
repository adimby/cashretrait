import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildHistory } from '../../scripts/build-history'
import type { Tariffs } from '../../src/tariffs/schema'

const base = JSON.parse(readFileSync('tests/fixtures/tarifs.snapshot.json', 'utf8')) as Tariffs
const withFee = (fee: number): Tariffs => {
  const t = structuredClone(base)
  ;(t.operators.mvola.fees.withdrawal![0] as { fee: number }).fee = fee
  return t
}
const v1 = withFee(100)
const v3 = withFee(120)

describe('buildHistory', () => {
  it('omet les versions sans changement', () => {
    const h = buildHistory([
      { date: '2026-01-01', tariffs: v1 },
      { date: '2026-02-01', tariffs: structuredClone(v1) },
      { date: '2026-03-01', tariffs: v3 },
    ])
    expect(h).toHaveLength(1)
    expect(h[0].date).toBe('2026-03-01')
    expect(h[0].changes).toHaveLength(1)
    expect(h[0].changes[0]).toMatchObject({ operator: 'mvola', operation: 'withdrawal', before: 100, after: 120 })
  })

  it('trie chronologiquement les versions désordonnées', () => {
    const h = buildHistory([
      { date: '2026-03-01', tariffs: v3 },
      { date: '2026-01-01', tariffs: v1 },
      { date: '2026-02-01', tariffs: withFee(110) },
    ])
    expect(h.map((e) => e.date)).toEqual(['2026-02-01', '2026-03-01'])
  })
})
