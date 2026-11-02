import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { feeLowerBound } from '../../src/engine/bounds'
import { bruteforceAll } from './bruteforce'
import type { FeeTable, Tariffs } from '../../src/tariffs/schema'

const tariffs: Tariffs = JSON.parse(readFileSync('tests/fixtures/tarifs.snapshot.json', 'utf8'))

describe('feeLowerBound never exceeds the true optimum', () => {
  const tables: [string, FeeTable][] = [
    ['percent', [{ min: 100, max: 10000, fee: 200 }, { min: 10001, max: 50000, feePercent: 1.5 }, { min: 50001, max: 2000000, fee: 900 }]],
    ['non-monotone', [{ min: 100, max: 1000, fee: 100 }, { min: 1001, max: 5000, fee: 2000 }, { min: 5001, max: 10000, fee: 200 }]],
  ]
  for (const op of ['mvola', 'airtel', 'orange'] as const) tables.push([`${op}.withdrawal`, tariffs.operators[op].fees.withdrawal!])
  for (const [name, table] of tables) {
    it(name, () => {
      const step = 100
      for (let p = 1; p <= 3; p++) {
        // The DP gives the optimum over ≤ p parts, so compare it with min over q ≤ p of lb(R, q).
        const ref = bruteforceAll(table, 30000, step, p, 100, 20000000)
        const lb = feeLowerBound(table, 100, 20000000)
        for (let i = 1; i < ref.length; i++) {
          if (ref[i] === null) continue
          let low = Infinity
          for (let q = 1; q <= p; q++) low = Math.min(low, lb(i * step, q))
          expect(low, `${name} p=${p} @ ${i * step}`).toBeLessThanOrEqual(ref[i]!)
        }
      }
    })
  }
})
