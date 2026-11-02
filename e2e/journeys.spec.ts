import { test, expect, type Locator, type Page } from '@playwright/test'

const SPACES = /[\s  ]/g
/** '1 234 Ar' (any kind of space) → 1234; every Ar amount in a text. */
const amounts = (text: string) => [...text.replace(SPACES, '').matchAll(/(\d+)Ar/g)].map((m) => Number(m[1]))
const textOf = async (l: Locator) => (await l.innerText()).replace(SPACES, ' ')
const nav = (page: Page) => page.getByRole('navigation', { name: 'Navigation principale' })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Calculer' })).toBeVisible()
})

test('Envoyer : 250 000 Ar MVola vers MVola, découpage dont la somme fait le montant', async ({ page }) => {
  await page.getByRole('radio', { name: 'Envoyer' }).check({ force: true })
  await page.getByRole('radio', { name: 'MVola' }).first().check({ force: true })
  await page.getByRole('radio', { name: 'MVola' }).nth(1).check({ force: true })
  await page.getByLabel(/montant/i).first().fill('250000')
  const result = page.getByRole('region', { name: 'Meilleure option' })
  await expect(result).toBeVisible()
  await expect(result.locator('.path-line')).toContainText(/Vers un compte MVola|Avec l'application MVola/)
  await expect(result.locator('.tx-head').first()).toHaveText(/Faites \d+ envois?/)
  const rows = result.locator('.tx-list .tx-row')
  const n = await rows.count()
  expect(n).toBeGreaterThan(0)
  let sum = 0
  for (let i = 0; i < n; i++) sum += Number((await rows.nth(i).locator('.plate').first().innerText()).replace(/\D/g, ''))
  expect(sum).toBe(250000)
  expect(amounts(await textOf(result.locator('.result-total')))[0]).toBeGreaterThan(0)
})

test('Le destinataire doit recevoir, frais non compris : seul le retrait réellement possible est proposé', async ({ page }) => {
  await page.getByRole('radio', { name: 'Le destinataire doit recevoir' }).check({ force: true })
  await page.getByRole('radio', { name: 'MVola' }).first().check({ force: true })
  await page.getByRole('radio', { name: 'MVola' }).nth(1).check({ force: true })
  await page.getByLabel(/montant/i).first().fill('100000')
  const checkbox = page.getByRole('checkbox')
  if (await checkbox.isChecked()) await checkbox.uncheck()
  const result = page.getByRole('region', { name: 'Meilleure option' })
  await expect(result.getByTestId('notincl-fee')).toContainText(/il lui faudrait aussi/)
  await expect(result.getByText(/^Il fait/)).toHaveCount(0)
  const head = result.locator('.tx-head', { hasText: 'Il peut retirer au plus' })
  await expect(head).toBeVisible()
  const max = amounts(await textOf(head))[0]
  expect(max).toBeGreaterThan(0)
  expect(max).toBeLessThan(100000)
})

test('Comparer : coût mensuel des trois opérateurs, le moins cher en tête', async ({ page }) => {
  await nav(page).getByRole('link', { name: 'Comparer' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Comparer' })).toBeVisible()
  await page.getByLabel('Montant à chaque fois').first().fill('120000')
  const out = page.getByRole('region', { name: 'Frais par mois' })
  const rows = out.locator('.rank-row')
  await expect(rows).toHaveCount(3)
  await expect(rows.first()).toContainText('Le moins cher')
  const totals: number[] = []
  for (let i = 0; i < 3; i++) totals.push(...amounts(await textOf(rows.nth(i).locator('.rank-total'))))
  expect(totals).toEqual([...totals].sort((a, b) => a - b))
  await page.getByRole('button', { name: 'Une fois de plus par mois' }).first().click()
  await expect(out.getByText(/Selon vos réglages/)).toBeVisible()
})

test('Tarifs : grille Airtel Money, retrait, bornes réelles et historique', async ({ page }) => {
  await nav(page).getByRole('link', { name: 'Tarifs' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Tarifs' })).toBeVisible()
  await page.getByRole('radio', { name: 'Airtel Money' }).first().check({ force: true })
  await page.getByRole('radio', { name: /^Retrait/ }).first().check({ force: true })
  await expect(page.getByRole('table', { name: 'Retrait, Airtel Money' })).toBeVisible()
  await expect(page.getByText(/^Modifiée le \d{2}\/\d{2}\/\d{4}$/)).toBeVisible()
  const limits = await textOf(page.getByText(/^Par transaction : de/))
  const [min, max] = amounts(limits)
  expect(min).toBeGreaterThan(0)
  expect(max).toBeGreaterThan(min)
  await expect(page.getByRole('heading', { name: 'Historique des changements' })).toBeVisible()
})

test('Plus : garder un calcul, le rouvrir depuis Favoris, puis À propos', async ({ page }) => {
  await page.getByRole('radio', { name: 'Retirer' }).check({ force: true })
  await page.getByRole('radio', { name: 'MVola' }).first().check({ force: true })
  await page.getByLabel(/montant/i).first().fill('50000')
  await expect(page.getByRole('region', { name: 'Meilleure option' })).toBeVisible()
  await page.getByRole('button', { name: 'Garder ce calcul dans vos favoris' }).click()

  await nav(page).getByRole('link', { name: 'Plus' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Plus' })).toBeVisible()
  await page.getByRole('link', { name: /Favoris/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Favoris' })).toBeVisible()
  await page.getByRole('button', { name: /^Retrait MVola 50.000.Ar Ouvrir dans Calculer/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Calculer' })).toBeVisible()
  await expect(page.getByLabel(/montant/i).first()).toHaveValue(/50.?000/)
  await expect(page.getByRole('region', { name: 'Meilleure option' })).toBeVisible()

  await nav(page).getByRole('link', { name: 'Plus' }).click()
  await page.getByRole('link', { name: /À propos/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'À propos' })).toBeVisible()
  await expect(page.getByText(/non affiliée à MVola, Airtel ou Orange/).first()).toBeVisible()
})
