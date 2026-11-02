import { describe, it, expect, beforeEach, vi } from 'vitest'

class MemStorage {
  m = new Map<string, string>()
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null }
  setItem(k: string, v: string) { this.m.set(k, String(v)) }
  removeItem(k: string) { this.m.delete(k) }
}

async function fresh(stored?: string) {
  const s = new MemStorage()
  if (stored !== undefined) s.setItem('cr.usages', stored)
  vi.stubGlobal('localStorage', s)
  vi.resetModules()
  return { s, mod: await import('../../src/ui/state/usages') }
}

describe('usages', () => {
  beforeEach(() => vi.unstubAllGlobals())
  it('defaults to one withdrawal usage', async () => {
    const { mod } = await fresh()
    expect(mod.usages.value).toEqual(mod.DEFAULT_USAGES)
  })
  it('persists edits under cr.usages', async () => {
    const { s, mod } = await fresh()
    mod.setUsages([{ operation: 'transfer_same', amount: 20000, perMonth: 3 }])
    expect(JSON.parse(s.getItem('cr.usages')!)).toEqual([{ operation: 'transfer_same', amount: 20000, perMonth: 3 }])
  })
  it('restores stored usages, dropping invalid ones and keeping an empty amount', async () => {
    const { mod } = await fresh(JSON.stringify([
      { operation: 'withdrawal', amount: 50000, perMonth: 4 },
      { operation: 'teleport', amount: 1, perMonth: 1 },
      { operation: 'transfer_other_op', amount: null, perMonth: 2 },
      { operation: 'withdrawal', amount: 1000, perMonth: -1 },
    ]))
    expect(mod.usages.value).toEqual([
      { operation: 'withdrawal', amount: 50000, perMonth: 4 },
      { operation: 'transfer_other_op', amount: null, perMonth: 2 },
    ])
  })
  it('falls back to defaults on garbage', async () => {
    const { mod } = await fresh('"x"')
    expect(mod.usages.value).toEqual(mod.DEFAULT_USAGES)
  })
})
