import { describe, it, expect, beforeEach } from 'vitest'
import fr from '../../src/ui/i18n/fr.json'
import mg from '../../src/ui/i18n/mg.json'
import { t, lang } from '../../src/ui/i18n'

const keys = (o: Record<string, unknown>) => Object.keys(o).filter((k) => !k.startsWith('_')).sort()

describe('i18n', () => {
  beforeEach(() => { lang.value = 'fr' })
  it('fr and mg have exactly the same keys', () => {
    expect(keys(mg)).toEqual(keys(fr))
  })
  it('mg.json is flagged for native review', () => {
    expect(Object.keys(mg)[0]).toBe('_review')
    expect((mg as Record<string, string>)._review).toBe('à relire par un locuteur natif')
  })
  it('no empty strings', () => {
    for (const d of [fr, mg] as Record<string, string>[]) for (const k of keys(d)) expect(d[k].trim()).not.toBe('')
  })
  it('replaces {montant}', () => {
    expect(t('test.vars', { montant: '25 000 Ar' })).toBe('Avec 25 000 Ar')
  })
  it('follows lang signal', () => {
    lang.value = 'mg'
    expect(t('nav.calculer')).toBe((mg as Record<string, string>)['nav.calculer'])
    lang.value = 'fr'
    expect(t('nav.calculer')).toBe('Calculer')
  })
  it('returns the key for unknown keys', () => {
    expect(t('nope.missing')).toBe('nope.missing')
  })
  it('disclaimer text is exact', () => {
    expect(t('disclaimer')).toBe('Calcul indicatif basé sur les grilles publiques des opérateurs. Application indépendante, non affiliée à MVola, Airtel ou Orange.')
  })
  it('no USSD codes or tel: links in strings', () => {
    for (const d of [fr, mg] as Record<string, string>[]) for (const k of keys(d)) {
      expect(d[k]).not.toMatch(/tel:|\*\d+#|#\d+\*/)
    }
  })
})
