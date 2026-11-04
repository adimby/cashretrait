import { test, expect, type Page } from '@playwright/test'

const NBSP = /[   ]/g
/** Text with every kind of space folded to a plain one. */
const flat = async (page: Page) => ((await page.locator('main, body').first().innerText()).replace(NBSP, ' '))

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Calculer' })).toBeVisible()
})

async function setStep100(page: Page) {
  await page.getByRole('link', { name: 'Plus' }).click()
  await page.getByRole('link', { name: /Réglages/ }).click()
  await page.getByRole('radio', { name: /^100/ }).check({ force: true })
  await page.getByRole('link', { name: 'Calculer' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Calculer' })).toBeVisible()
}

test('retirer 1 000 001 Ar (pas 100) : total 8 900 Ar et une économie', async ({ page }) => {
  await setStep100(page)
  await page.getByRole('radio', { name: 'Retirer' }).check({ force: true })
  await page.getByRole('radio', { name: 'MVola' }).first().check({ force: true })
  await page.getByLabel(/montant/i).first().fill('1000001')
  const result = page.getByRole('region', { name: 'Meilleure option' })
  await expect(result).toBeVisible()
  await expect(result.locator('.result-total')).toContainText('8 900')
  await expect(result.locator('.result-savings')).toContainText(/Économie/)
})

test('retirer 540 000 Ar MVola : même budget (548 800 Ar) → 542 000 Ar en découpant', async ({ page }) => {
  await page.getByRole('radio', { name: 'Retirer' }).check({ force: true })
  await page.getByRole('radio', { name: 'MVola' }).first().check({ force: true })
  await page.getByLabel(/montant/i).first().fill('540000')
  const card = page.getByRole('region', { name: "Même budget, plus d'argent" })
  await expect(card).toBeVisible()
  const text = (await card.innerText()).replace(NBSP, ' ')
  expect(text).toContain('548 800')
  expect(text).toContain('542 000')
  expect(text).toMatch(/2 000 Ar de plus en main/)
  // Only in Retirer.
  await page.getByRole('radio', { name: 'Vider', exact: true }).check({ force: true })
  await expect(page.getByRole('region', { name: "Même budget, plus d'argent" })).toHaveCount(0)
})

test('le destinataire doit recevoir 100 000 Ar, MVola vers MVola, frais compris', async ({ page }) => {
  await page.getByRole('radio', { name: 'Faire recevoir' }).check({ force: true })
  await page.getByRole('radio', { name: 'MVola' }).first().check({ force: true })
  await page.getByRole('radio', { name: 'MVola' }).nth(1).check({ force: true })
  await page.getByLabel(/montant/i).first().fill('100000')
  const checkbox = page.getByRole('checkbox')
  if (!(await checkbox.isChecked())) await checkbox.check()
  const result = page.getByRole('region', { name: 'Meilleure option' })
  await expect(result).toBeVisible()
  await expect(result.locator('.result-lead')).toContainText('101 900'.replace(' ', ' '))
})

test('vider mon compte avec un solde de 487 350 Ar : montant affiché et mention indicative', async ({ page }) => {
  await page.getByRole('radio', { name: 'Vider', exact: true }).check({ force: true })
  await expect(page.getByText(/plus gros montant que vous pouvez retirer/)).toBeVisible()
  await page.getByRole('radio', { name: 'MVola' }).first().check({ force: true })
  await page.getByLabel(/solde|montant/i).first().fill('487350')
  const result = page.getByRole('region', { name: 'Meilleure option' })
  await expect(result.locator('.result-lead-label')).toHaveText('Vous pouvez retirer')
  const lead = (await result.locator('.result-lead').innerText()).replace(/[\s\u00a0\u202f]/g, '')
  const m = /(\d+)Ar/.exec(lead)
  expect(m, `montant en Ar dans « ${lead} »`).not.toBeNull()
  const amount = Number(m![1])
  expect(amount).toBeGreaterThan(0)
  expect(amount).toBeLessThanOrEqual(487350)
  // Amount + fees + remaining add up to the balance.
  const total = Number(/(\d+)Ar/.exec((await result.locator('.result-total').innerText()).replace(/[\s\u00a0\u202f]/g, ''))![1])
  expect(amount + total).toBeLessThanOrEqual(487350)
  await expect(result.getByText(/Calcul indicatif/)).toBeVisible()
  expect(await flat(page)).toMatch(/Il vous restera/)
})

test('retrait sans compte (0 Ar de frais) : les frais ont été payés par l’expéditeur', async ({ page }) => {
  await page.getByRole('radio', { name: 'Retirer' }).check({ force: true })
  await page.getByRole('radio', { name: 'MVola' }).first().check({ force: true })
  await page.getByRole('checkbox', { name: 'Retrait sans compte (avec un code)' }).check({ force: true })
  await page.getByLabel(/montant/i).first().fill('50000')
  const result = page.getByRole('region', { name: 'Meilleure option' })
  await expect(result.getByText(/payés par l'expéditeur/)).toBeVisible()
})

test('montants rapides : visibles si le champ est vide ou en cours de saisie, masqués ensuite', async ({ page }) => {
  const quick = page.getByRole('group', { name: /montants rapides|Montants/i })
  await expect(quick).toBeVisible()
  const field = page.getByLabel(/montant/i).first()
  await field.fill('540000')
  await page.getByRole('heading', { name: 'Meilleure option' }).click()
  await expect(quick).toHaveCount(0)
  await field.focus()
  await expect(quick).toBeVisible()
  await quick.getByRole('button').nth(2).click()
  await expect(field).toHaveValue(/100.000/)
})
