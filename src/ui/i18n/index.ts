import { signal, type Signal } from '@preact/signals'
import fr from './fr.json'
import mg from './mg.json'

export type Lang = 'fr' | 'mg'
export const LANGS: readonly Lang[] = ['fr', 'mg']

const dicts: Record<Lang, Record<string, string>> = { fr, mg }

export const lang: Signal<Lang> = signal<Lang>('fr')

/** Translate `key` in the current language; `{name}` placeholders are replaced from `vars`.
 *  Falls back to French, then to the key itself. Reading `lang.value` subscribes components. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const s = dicts[lang.value][key] ?? dicts.fr[key] ?? key
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s
}
