import { describe, it, expect, beforeEach, vi } from 'vitest'

class MemStorage {
  m = new Map<string, string>()
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null }
  setItem(k: string, v: string) { this.m.set(k, String(v)) }
  removeItem(k: string) { this.m.delete(k) }
}

async function fresh(stored?: string) {
  const s = new MemStorage()
  if (stored !== undefined) s.setItem('cr.favorites', stored)
  vi.stubGlobal('localStorage', s)
  vi.resetModules()
  const mod = await import('../../src/ui/state/favorites')
  return { s, mod }
}

const fav = { label: 'Retrait MVola 100 000 Ar', mode: 'withdraw' as const, params: { op: 'mvola', amount: 100000, customer: true } }

describe('favorites', () => {
  beforeEach(() => vi.unstubAllGlobals())
  it('starts empty', async () => {
    const { mod } = await fresh()
    expect(mod.favorites.value).toEqual([])
  })
  it('adds and persists', async () => {
    const { s, mod } = await fresh()
    mod.addFavorite(fav)
    expect(mod.favorites.value).toHaveLength(1)
    const f = mod.favorites.value[0]
    expect(f).toMatchObject(fav)
    expect(typeof f.id).toBe('string')
    expect(JSON.parse(s.getItem('cr.favorites')!)).toEqual(mod.favorites.value)
  })
  it('reloads what was stored', async () => {
    const { s, mod } = await fresh()
    mod.addFavorite(fav)
    const again = await fresh(s.getItem('cr.favorites')!)
    expect(again.mod.favorites.value).toEqual(mod.favorites.value)
  })
  it('removes and persists', async () => {
    const { s, mod } = await fresh()
    mod.addFavorite(fav)
    mod.addFavorite({ ...fav, label: 'B', params: { ...fav.params, amount: 50000 } })
    const [a, b] = mod.favorites.value
    expect(a.id).not.toBe(b.id)
    mod.removeFavorite(a.id)
    expect(mod.favorites.value.map((f) => f.id)).toEqual([b.id])
    expect(JSON.parse(s.getItem('cr.favorites')!).map((f: { id: string }) => f.id)).toEqual([b.id])
  })
  it('does not add the same calculation twice', async () => {
    const { mod } = await fresh()
    mod.addFavorite(fav)
    mod.addFavorite({ ...fav, label: 'other label' })
    expect(mod.favorites.value).toHaveLength(1)
    expect(mod.findFavorite('withdraw', { customer: true, amount: 100000, op: 'mvola' })?.label).toBe(fav.label)
  })
  it('drops corrupt entries', async () => {
    const { mod } = await fresh(JSON.stringify([{ id: 'x', label: 'ok', mode: 'max', params: { op: 'mvola', amount: 5 } }, { id: 1 }, 'junk', { id: 'y', label: 'bad', mode: 'nope', params: {} }]))
    expect(mod.favorites.value.map((f) => f.id)).toEqual(['x'])
    const c = await fresh('{oops')
    expect(c.mod.favorites.value).toEqual([])
  })
  it('survives a throwing localStorage', async () => {
    vi.stubGlobal('localStorage', { getItem() { throw new Error('x') }, setItem() { throw new Error('x') } })
    vi.resetModules()
    const mod = await import('../../src/ui/state/favorites')
    expect(() => mod.addFavorite(fav)).not.toThrow()
    expect(mod.favorites.value).toHaveLength(1)
  })
  it('restores a removed favorite at its place', async () => {
    const { s, mod } = await fresh()
    mod.addFavorite(fav)
    mod.addFavorite({ ...fav, params: { ...fav.params, amount: 5000 } })
    const [first, second] = mod.favorites.value
    mod.removeFavorite(second.id)
    mod.restoreFavorite(second, 1)
    expect(mod.favorites.value.map((f) => f.id)).toEqual([first.id, second.id])
    mod.restoreFavorite(second, 0)
    expect(mod.favorites.value).toHaveLength(2)
    expect(JSON.parse(s.getItem('cr.favorites')!)).toHaveLength(2)
  })
})
