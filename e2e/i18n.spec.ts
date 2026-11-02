import { test, expect } from '@playwright/test'

test('passage en malagasy : navigation traduite et conservée au rechargement', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  await expect(nav.getByRole('link', { name: 'Calculer' })).toBeVisible()

  await nav.getByRole('link', { name: 'Plus' }).click()
  await page.getByRole('link', { name: /Réglages/ }).click()
  await page.getByRole('radio', { name: 'Malagasy' }).check({ force: true })

  const navMg = page.getByRole('navigation', { name: 'Fitetezana lehibe' })
  await expect(navMg.getByRole('link', { name: 'Kajy' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('navigation', { name: 'Fitetezana lehibe' }).getByRole('link', { name: 'Kajy' })).toBeVisible()
})
