import { test, expect } from '@playwright/test'

// Smoke test against a real deployment: BASE_URL=https://… npm run e2e. Skipped otherwise, because
// `vite preview` cannot apply vercel.json (404 on /admin, X-Robots-Tag headers).
const BASE_URL = process.env.BASE_URL

test.describe('déploiement (BASE_URL)', () => {
  test.skip(!BASE_URL, 'BASE_URL non défini')

  test('/admin répond 404', async ({ playwright }) => {
    const api = await playwright.request.newContext({ baseURL: BASE_URL })
    const res = await api.get('/admin', { maxRedirects: 0 })
    expect(res.status()).toBe(404)
    await api.dispose()
  })

  test('la page d’administration et ses scripts portent X-Robots-Tag noindex', async ({ playwright }) => {
    const api = await playwright.request.newContext({ baseURL: BASE_URL })
    const page = await api.get('/zadmin')
    expect(page.status()).toBe(200)
    expect(page.headers()['x-robots-tag']).toMatch(/noindex/)
    expect(page.headers()['cache-control']).toMatch(/no-store/)
    const script = /src="(\/assets\/zadmin[^"]+\.js)"/.exec(await page.text())?.[1]
    expect(script, 'script de la page d’administration').toBeTruthy()
    const asset = await api.get(script!)
    expect(asset.status()).toBe(200)
    expect(asset.headers()['x-robots-tag']).toMatch(/noindex/)
    await api.dispose()
  })

  test('tarifs.json est servi', async ({ playwright }) => {
    const api = await playwright.request.newContext({ baseURL: BASE_URL })
    const res = await api.get('/tarifs.json')
    expect(res.status()).toBe(200)
    expect((await res.json()).schemaVersion).toBeTruthy()
    await api.dispose()
  })
})
