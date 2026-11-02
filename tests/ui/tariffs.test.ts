import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'

const good = JSON.parse(readFileSync('public/tarifs.json', 'utf8'))

class MemStorage {
  m = new Map<string, string>()
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null }
  setItem(k: string, v: string) { this.m.set(k, String(v)) }
  removeItem(k: string) { this.m.delete(k) }
}

const res = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response

async function fresh() {
  vi.stubGlobal('localStorage', new MemStorage())
  vi.resetModules()
  return import('../../src/ui/state/tariffs')
}

describe('loadTariffs', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('loads valid tariffs', async () => {
    const m = await fresh()
    const f = vi.fn(async () => res(good))
    const r = await m.loadTariffs(f as unknown as typeof fetch)
    expect(r.stale).toBe(false)
    expect(r.tariffs.operators.mvola.name).toBe('MVola')
    expect(m.tariffs.value).toEqual(r.tariffs)
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('refetches with cache: reload when schemaVersion mismatches', async () => {
    const m = await fresh()
    const f = vi.fn()
      .mockResolvedValueOnce(res({ ...good, schemaVersion: 0 }))
      .mockResolvedValueOnce(res(good))
    const r = await m.loadTariffs(f as unknown as typeof fetch)
    expect(f).toHaveBeenCalledTimes(2)
    expect(f.mock.calls[1][1]).toMatchObject({ cache: 'reload' })
    expect(r.tariffs.schemaVersion).toBe(1)
    expect(r.stale).toBe(false)
  })

  it('network failure with a cached copy → stale: true', async () => {
    const m = await fresh()
    await m.loadTariffs((async () => res(good)) as unknown as typeof fetch)
    const r = await m.loadTariffs((async () => { throw new TypeError('offline') }) as unknown as typeof fetch)
    expect(r.stale).toBe(true)
    expect(r.tariffs.updatedAt).toBe(good.updatedAt)
  })

  it('cached copy survives a reload of the module (localStorage)', async () => {
    const s = new MemStorage()
    vi.stubGlobal('localStorage', s)
    vi.resetModules()
    let m = await import('../../src/ui/state/tariffs')
    await m.loadTariffs((async () => res(good)) as unknown as typeof fetch)
    vi.resetModules()
    m = await import('../../src/ui/state/tariffs')
    const r = await m.loadTariffs((async () => res(null, 503)) as unknown as typeof fetch)
    expect(r.stale).toBe(true)
  })

  it('invalid payload with no cache → throws', async () => {
    const m = await fresh()
    await expect(m.loadTariffs((async () => res({ nope: 1 })) as unknown as typeof fetch)).rejects.toThrow()
  })

  it('still wrong version after reload → falls back to cache as stale', async () => {
    const m = await fresh()
    await m.loadTariffs((async () => res(good)) as unknown as typeof fetch)
    const r = await m.loadTariffs((async () => res({ ...good, schemaVersion: 2 })) as unknown as typeof fetch)
    expect(r.stale).toBe(true)
  })
})

describe('loadHistory', () => {
  it('returns null on 404', async () => {
    const m = await fresh()
    expect(await m.loadHistory((async () => res(null, 404)) as unknown as typeof fetch)).toBeNull()
  })
  it('returns null on network error', async () => {
    const m = await fresh()
    expect(await m.loadHistory((async () => { throw new TypeError('x') }) as unknown as typeof fetch)).toBeNull()
  })
  it('returns parsed json', async () => {
    const m = await fresh()
    expect(await m.loadHistory((async () => res({ changes: [] })) as unknown as typeof fetch)).toEqual({ changes: [] })
  })
})
