import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { validateTariffs, diffTariffs, formatChange, mergeOperator } from '../../src/tariffs/validate'
import type { Tariffs } from '../../src/tariffs/schema'

const load = (): Tariffs => JSON.parse(readFileSync('public/tarifs.json', 'utf8'))

describe('validateTariffs', () => {
  it('current tariffs vs themselves are ok and diff is empty', () => {
    const t = load()
    expect(validateTariffs(t, load())).toEqual({ status: 'ok', reasons: [] })
    expect(diffTariffs(t, load())).toEqual([])
  })
  it('accepts null prev', () => {
    expect(validateTariffs(load(), null).status).toBe('ok')
  })
  it('invalid on zod failure', () => {
    expect(validateTariffs({ foo: 1 }, load()).status).toBe('invalid')
  })
  it('invalid on gap between tiers', () => {
    const n = load()
    n.operators.mvola.fees.withdrawal![1].min += 1
    const v = validateTariffs(n, load())
    expect(v.status).toBe('invalid')
    expect(v.reasons.join(' ')).toMatch(/mvola/)
  })
  it('invalid on overlap and on unsorted tiers', () => {
    const n = load()
    n.operators.mvola.fees.withdrawal![1].min -= 1
    expect(validateTariffs(n, load()).status).toBe('invalid')
    const u = load()
    u.operators.mvola.fees.withdrawal!.reverse()
    expect(validateTariffs(u, load()).status).toBe('invalid')
  })
  it('invalid when tiers exceed limits', () => {
    const n = load()
    const w = n.operators.mvola.fees.withdrawal!
    w[w.length - 1].max = n.operators.mvola.limits.maxTx + 1
    expect(validateTariffs(n, load()).status).toBe('invalid')
  })
  it('suspect when a fee doubles, naming operator and tier', () => {
    const n = load()
    const t = n.operators.mvola.fees.withdrawal![3] as { fee: number; min: number }
    t.fee *= 2
    const v = validateTariffs(n, load())
    expect(v.status).toBe('suspect')
    expect(v.reasons.join(' ')).toMatch(/mvola/i)
    expect(v.reasons.join(' ')).toContain(String(t.min))
  })
  it('suspect when decreasing fee across tiers', () => {
    const n = load()
    const w = n.operators.mvola.fees.withdrawal!
    ;(w[2] as { fee: number }).fee = (w[1] as { fee: number }).fee - 1
    expect(validateTariffs(n, null).status).toBe('suspect')
  })
  it('suspect when an operation disappears', () => {
    const n = load()
    delete n.operators.airtel.fees.withdrawal
    const v = validateTariffs(n, load())
    expect(v.status).toBe('suspect')
    expect(v.reasons.join(' ')).toMatch(/airtel/)
  })
})

describe('tier set changes', () => {
  const sus = (n: Tariffs) => validateTariffs(n, load())
  it('dropped last tier is suspect', () => {
    const n = load()
    n.operators.mvola.fees.withdrawal!.pop()
    const v = sus(n)
    expect(v.status).toBe('suspect')
    expect(v.reasons.join(' ')).toMatch(/mvola withdrawal .*palier disparu/)
  })
  it('moved boundary is suspect', () => {
    const n = load()
    const w = n.operators.mvola.fees.withdrawal!
    w[1].max += 1
    w[2].min += 1
    expect(sus(n).status).toBe('suspect')
  })
  it('fee to percent switch is suspect', () => {
    const n = load()
    const w = n.operators.mvola.fees.withdrawal!
    w[1] = { min: w[1].min, max: w[1].max, feePercent: 1.5 }
    expect(sus(n).status).toBe('suspect')
  })
  it('missing operator is invalid', () => {
    const n = load() as unknown as { operators: Record<string, unknown> }
    delete n.operators.airtel
    expect(sus(n as unknown as Tariffs).status).toBe('invalid')
  })
})

describe('diff / format / merge', () => {
  it('diffs changed, added and removed ranges', () => {
    const p = load()
    const n = load()
    const w = n.operators.mvola.fees.withdrawal!
    ;(w[3] as { fee: number }).fee += 200
    const ch = diffTariffs(p, n)
    expect(ch).toHaveLength(1)
    expect(ch[0]).toMatchObject({ operator: 'mvola', operation: 'withdrawal', min: w[3].min, max: w[3].max, after: (w[3] as { fee: number }).fee })
    const removed = diffTariffs(n, { ...n, operators: { ...n.operators, mvola: { ...n.operators.mvola, fees: { ...n.operators.mvola.fees, withdrawal: w.slice(0, -1) } } } })
    expect(removed).toHaveLength(1)
    expect(removed[0].after).toBeNull()
    expect(removed[0].before).not.toBeNull()
  })
  it('formatChange fr / mg / unavailable', () => {
    const c = { operator: 'mvola' as const, operation: 'withdrawal' as const, min: 25001, max: 50000, before: 1300, after: 1500 }
    expect(formatChange(c, 'fr')).toBe('MVola retrait 25 001–50 000 : 1 300 → 1 500')
    expect(formatChange(c, 'mg')).toBe('MVola fisintonana 25 001–50 000 : 1 300 → 1 500')
    expect(formatChange({ ...c, after: null }, 'fr')).toBe('MVola retrait 25 001–50 000 : 1 300 → —')
  })
  it('formatChange mg transfer_other_op and percent', () => {
    const c = { operator: 'airtel' as const, operation: 'transfer_other_op' as const, min: 100, max: 1000, before: 1500, after: 1.5, afterPercent: true }
    expect(formatChange(c, 'mg')).toBe('Airtel Money fandefasana tambazotra hafa 100–1 000 : 1 500 → 1,5 %')
  })
  it('mergeOperator replaces only the given operator and updates updatedAt', () => {
    const p = load()
    const op = { ...p.operators.orange, name: 'Orange X' }
    const now = new Date('2030-01-02T03:04:05.000Z')
    const m = mergeOperator(p, 'orange', op, now)
    expect(m.operators.orange.name).toBe('Orange X')
    expect(m.operators.mvola).toBe(p.operators.mvola)
    expect(m.operators.airtel).toBe(p.operators.airtel)
    expect(m.updatedAt).toBe('2030-01-02T03:04:05.000Z')
    expect(p.operators.orange.name).not.toBe('Orange X')
  })
})
