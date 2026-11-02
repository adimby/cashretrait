import { test, expect } from '@playwright/test'

// /admin returning 404 and the response headers (X-Robots-Tag, no-store) are configured in vercel.json
// and can only be checked on the Vercel deployment: `vite preview` falls back to the SPA shell.

test('/admin n’affiche aucune page de connexion', async ({ page }) => {
  await page.goto('/admin')
  await expect(page.getByLabel(/mot de passe/i)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /administration|connexion/i })).toHaveCount(0)
})

test('la page d’administration n’est pas indexable (meta robots noindex)', async ({ request }) => {
  const res = await request.get('/zadmin.html')
  expect(res.ok()).toBe(true)
  expect(await res.text()).toMatch(/<meta name="robots" content="[^"]*noindex/)
})

test('la page d’administration affiche la connexion', async ({ page }) => {
  await page.goto('/zadmin.html')
  await expect(page.getByLabel(/mot de passe/i)).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
})
