import { signal, type Signal } from '@preact/signals'
import { lang, type Lang } from '../i18n'
import { readJson, writeJson } from './storage'

export type Settings = { lang: Lang; step: 100 | 1000 | 5000; maxTx: number }

export const STORAGE_KEY = 'cr.settings'
export const STEPS = [100, 1000, 5000] as const
export const MAX_TX_MIN = 1
export const MAX_TX_MAX = 10
export const DEFAULT_SETTINGS: Settings = { lang: 'fr', step: 1000, maxTx: 5 }

function sanitize(raw: unknown): Settings {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const d = DEFAULT_SETTINGS
  return {
    lang: o.lang === 'fr' || o.lang === 'mg' ? o.lang : d.lang,
    step: (STEPS as readonly unknown[]).includes(o.step) ? (o.step as Settings['step']) : d.step,
    maxTx: Number.isInteger(o.maxTx) && (o.maxTx as number) >= MAX_TX_MIN && (o.maxTx as number) <= MAX_TX_MAX ? (o.maxTx as number) : d.maxTx,
  }
}

export const settings: Signal<Settings> = signal(sanitize(readJson(STORAGE_KEY)))
lang.value = settings.value.lang

export function updateSettings(patch: Partial<Settings>): void {
  const next = sanitize({ ...settings.value, ...patch })
  settings.value = next
  lang.value = next.lang
  writeJson(STORAGE_KEY, next)
}
