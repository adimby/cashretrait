import { describe, expect, it } from 'vitest'
import { tariffsRuntimeCaching } from '../../pwa.config'

type Match = (o: { url: URL; request: { cache: string } }) => boolean
const req = (path: string, cache = 'default') => ({ url: new URL(`https://x.test${path}`), request: { cache } })

/**
 * Workbox serialises urlPattern's *source* into dist/sw.js, so the matcher must work with no outer
 * scope: rebuild it from its text alone (as sw.js does) and call it.
 */
const isolated = (): Match => new Function(`return (${tariffsRuntimeCaching.urlPattern!.toString()})`)() as Match

describe('service worker runtime caching of tariffs', () => {
  it('NetworkFirst with a 3 s network timeout (new fees on the first open after an update)', () => {
    expect(tariffsRuntimeCaching.handler).toBe('NetworkFirst')
    expect(tariffsRuntimeCaching.options?.networkTimeoutSeconds).toBe(3)
    expect(tariffsRuntimeCaching.options?.cacheName).toBe('cr-tarifs')
  })
  it('the serialised matcher has no free identifiers (works evaluated in isolation)', () => {
    const match = isolated()
    expect(match(req('/tarifs.json'))).toBe(true)
    expect(match(req('/tarifs-history.json'))).toBe(true)
    expect(match(req('/assets/a.js'))).toBe(false)
    expect(match(req('/index.html'))).toBe(false)
    expect(match(req('/api/parse'))).toBe(false)
  })
  it("lets `cache: 'reload'` requests bypass the worker", () => {
    expect(isolated()(req('/tarifs.json', 'reload'))).toBe(false)
  })
})
