import { test, expect } from '@playwright/test'

test('hors ligne : le calcul fonctionne après rechargement', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Calculer' })).toBeVisible()
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  // The worker must control the page (and have cached tarifs.json) before going offline.
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await expect(page.getByRole('radio', { name: 'MVola' }).first()).toBeVisible()

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Calculer' })).toBeVisible()
  await page.getByRole('radio', { name: 'Retirer' }).check({ force: true })
  await page.getByLabel(/montant/i).first().fill('50000')
  const result = page.getByRole('region', { name: 'Meilleure option' })
  await expect(result).toBeVisible()
  await expect(result.locator('.result-total')).toContainText(/\d/)
})
