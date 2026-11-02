import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import type { Tariffs } from '../../src/tariffs/schema'

class MemStorage {
  m = new Map<string, string>()
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null }
  setItem(k: string, v: string) { this.m.set(k, String(v)) }
  removeItem(k: string) { this.m.delete(k) }
}

const base: Tariffs = JSON.parse(readFileSync('public/tarifs.json', 'utf8'))
const clone = (): Tariffs => JSON.parse(JSON.stringify(base))

async function fresh() {
  const s = new MemStorage()
  vi.stubGlobal('localStorage', s)
  vi.resetModules()
  return { s, mod: await import('../../src/ui/state/lastSeen') }
}

describe('lastSeen', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('first visit (no lastSeen): no pending change', async () => {
    const { mod } = await fresh()
    expect(mod.pendingChanges(base, null)).toEqual([])
  })

  it('one fee differs: one change', async () => {
    const { mod } = await fresh()
    const seen = clone()
    const tier = seen.operators.mvola.fees.withdrawal![3] as { fee: number }
    tier.fee += 100
    const changes = mod.pendingChanges(base, seen)
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ operator: 'mvola', operation: 'withdrawal', before: tier.fee, after: tier.fee - 100 })
  })

  it('after markSeen, nothing is pending and it is persisted', async () => {
    const { s, mod } = await fresh()
    mod.markSeen(base)
    const read = mod.readLastSeen()
    expect(read).not.toBeNull()
    expect(mod.pendingChanges(base, read)).toEqual([])
    expect(JSON.parse(s.getItem('cr.lastSeen')!).updatedAt).toBe(base.updatedAt)
    expect(mod.lastSeen.value?.updatedAt).toBe(base.updatedAt)
  })

  it('ignores a corrupt stored value', async () => {
    const s = new MemStorage()
    s.setItem('cr.lastSeen', '{"nope":1}')
    vi.stubGlobal('localStorage', s)
    vi.resetModules()
    const mod = await import('../../src/ui/state/lastSeen')
    expect(mod.readLastSeen()).toBeNull()
  })
})
