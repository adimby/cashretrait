import { describe, it, expect, beforeEach, vi } from 'vitest'

class MemStorage {
  m = new Map<string, string>()
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null }
  setItem(k: string, v: string) { this.m.set(k, String(v)) }
  removeItem(k: string) { this.m.delete(k) }
}

const DEFAULTS = { lang: 'fr', step: 1000, maxTx: 5 }

async function fresh(stored?: string) {
  const s = new MemStorage()
  if (stored !== undefined) s.setItem('cr.settings', stored)
  vi.stubGlobal('localStorage', s)
  vi.resetModules()
  const mod = await import('../../src/ui/state/settings')
  return { s, mod }
}

describe('settings', () => {
  beforeEach(() => vi.unstubAllGlobals())
  it('defaults when absent', async () => {
    const { mod } = await fresh()
    expect(mod.settings.value).toEqual(DEFAULTS)
  })
  it('defaults when JSON is corrupt', async () => {
    const { mod } = await fresh('{not json')
    expect(mod.settings.value).toEqual(DEFAULTS)
  })
  it('reads stored settings', async () => {
    const { mod } = await fresh(JSON.stringify({ lang: 'mg', step: 5000, maxTx: 8 }))
    expect(mod.settings.value).toEqual({ lang: 'mg', step: 5000, maxTx: 8 })
  })
  it('falls back field by field on invalid values', async () => {
    const { mod } = await fresh(JSON.stringify({ lang: 'en', step: 250, maxTx: 42 }))
    expect(mod.settings.value).toEqual(DEFAULTS)
  })
  it('persists updates and syncs lang', async () => {
    const { s, mod } = await fresh()
    const i18n = await import('../../src/ui/i18n')
    mod.updateSettings({ lang: 'mg', maxTx: 3 })
    expect(JSON.parse(s.getItem('cr.settings')!)).toEqual({ lang: 'mg', step: 1000, maxTx: 3 })
    expect(i18n.lang.value).toBe('mg')
  })
  it('survives a throwing localStorage', async () => {
    vi.stubGlobal('localStorage', { getItem() { throw new Error('x') }, setItem() { throw new Error('x') } })
    vi.resetModules()
    const mod = await import('../../src/ui/state/settings')
    expect(mod.settings.value).toEqual(DEFAULTS)
    expect(() => mod.updateSettings({ step: 100 })).not.toThrow()
    expect(mod.settings.value.step).toBe(100)
  })
  it('works with no localStorage at all', async () => {
    vi.resetModules()
    const mod = await import('../../src/ui/state/settings')
    expect(mod.settings.value).toEqual(DEFAULTS)
  })
})
