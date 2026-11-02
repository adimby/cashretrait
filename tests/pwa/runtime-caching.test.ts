import { describe, expect, it } from 'vitest'
import { tariffsRuntimeCaching } from '../../pwa.config'

type Match = (o: { url: URL; request: Request }) => boolean
const match = tariffsRuntimeCaching.urlPattern as unknown as Match
const req = (path: string, init?: RequestInit) => ({ url: new URL(`https://x.test${path}`), request: new Request(`https://x.test${path}`, init) })

describe('service worker runtime caching of tariffs', () => {
  it('NetworkFirst with a 3 s network timeout (new fees on the first open after an update)', () => {
    expect(tariffsRuntimeCaching.handler).toBe('NetworkFirst')
    expect(tariffsRuntimeCaching.options?.networkTimeoutSeconds).toBe(3)
    expect(tariffsRuntimeCaching.options?.cacheName).toBe('cr-tarifs')
  })
  it('handles tarifs.json and tarifs-history.json only', () => {
    expect(match(req('/tarifs.json'))).toBe(true)
    expect(match(req('/tarifs-history.json'))).toBe(true)
    expect(match(req('/index.html'))).toBe(false)
    expect(match(req('/api/parse'))).toBe(false)
  })
  it("lets `cache: 'reload'` requests bypass the worker", () => {
    expect(match(req('/tarifs.json', { cache: 'reload' }))).toBe(false)
  })
})
