import { signal } from '@preact/signals'

export type Tab = 'calculer' | 'comparer' | 'tarifs' | 'plus'
export const TABS: readonly Tab[] = ['calculer', 'comparer', 'tarifs', 'plus']
export const DEFAULT_PATH = '/calculer'

/** '#/plus/reglages' → '/plus/reglages'; unknown or empty → default. */
export function parseHash(hash: string): string {
  const path = hash.replace(/^#/, '') || DEFAULT_PATH
  const tab = path.split('/')[1] as Tab
  return TABS.includes(tab) ? path : DEFAULT_PATH
}

export const route = signal(parseHash(globalThis.location?.hash ?? ''))

export function tabOf(path: string): Tab {
  return path.split('/')[1] as Tab
}

export function startRouter(): void {
  const sync = () => {
    const p = parseHash(location.hash)
    if (`#${p}` !== location.hash) history.replaceState(null, '', `#${p}`)
    route.value = p
  }
  addEventListener('hashchange', sync)
  sync()
}
