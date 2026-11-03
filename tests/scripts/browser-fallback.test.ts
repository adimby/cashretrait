import { describe, expect, it, vi } from 'vitest'
import { withBrowserFallback } from '../../scripts/update-tariffs'

const enc = (s: string) => new TextEncoder().encode(s)
const dec = (b: Uint8Array) => new TextDecoder().decode(b)

describe('withBrowserFallback', () => {
  it('keeps the HTTP result when it already contains a table', async () => {
    const browser = vi.fn()
    const f = withBrowserFallback(async () => enc('<html><table><tr><td>1</td></tr></table></html>'), browser)
    expect(dec(await f('https://x'))).toContain('<table>')
    expect(browser).not.toHaveBeenCalled()
  })

  it('keeps a PDF without calling the browser', async () => {
    const browser = vi.fn()
    const f = withBrowserFallback(async () => enc('%PDF-1.7 ...'), browser)
    expect(dec(await f('https://x'))).toMatch(/^%PDF/)
    expect(browser).not.toHaveBeenCalled()
  })

  it('renders with the browser when the HTTP page is an empty JS shell', async () => {
    const f = withBrowserFallback(async () => enc('<div id="root"></div>'), async () => enc('<table><td>65</td></table>'))
    expect(dec(await f('https://x'))).toContain('<td>65</td>')
  })

  it('uses the browser when HTTP fails', async () => {
    const f = withBrowserFallback(async () => { throw new Error('HTTP 403') }, async () => enc('<table></table>'))
    expect(dec(await f('https://x'))).toBe('<table></table>')
  })

  it('returns the HTTP shell when the browser also fails, so the parser reports the missing table', async () => {
    const f = withBrowserFallback(async () => enc('<div id="root"></div>'), async () => { throw new Error('timeout') })
    expect(dec(await f('https://x'))).toBe('<div id="root"></div>')
  })

  it('throws when both fail', async () => {
    const f = withBrowserFallback(async () => { throw new Error('HTTP 403') }, async () => { throw new Error('timeout') })
    await expect(f('https://x')).rejects.toThrow('timeout')
  })
})
