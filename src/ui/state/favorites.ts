import { signal, type Signal } from '@preact/signals'
import { readJson, writeJson } from './storage'

export type CalcMode = 'withdraw' | 'send' | 'receive' | 'max'
export const CALC_MODES: readonly CalcMode[] = ['withdraw', 'send', 'receive', 'max']
export type FavParams = Record<string, string | number | boolean>
export type Favorite = { id: string; label: string; mode: CalcMode; params: FavParams }

export const FAVORITES_KEY = 'cr.favorites'
const MAX_FAVORITES = 50

const isParam = (v: unknown) => typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))

function sanitize(raw: unknown): Favorite[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((f): f is Favorite => {
    if (!f || typeof f !== 'object') return false
    const o = f as Record<string, unknown>
    const p = o.params as Record<string, unknown> | null
    return typeof o.id === 'string' && typeof o.label === 'string' && CALC_MODES.includes(o.mode as CalcMode)
      && !!p && typeof p === 'object' && !Array.isArray(p) && Object.values(p).every(isParam)
  }).slice(0, MAX_FAVORITES)
}

/** Saved calculations (localStorage 'cr.favorites'). */
export const favorites: Signal<Favorite[]> = signal(sanitize(readJson(FAVORITES_KEY)))

const key = (mode: CalcMode, params: FavParams) =>
  mode + JSON.stringify(Object.keys(params).sort().map((k) => [k, params[k]]))

export function findFavorite(mode: CalcMode, params: FavParams): Favorite | undefined {
  const k = key(mode, params)
  return favorites.value.find((f) => key(f.mode, f.params) === k)
}

function save(next: Favorite[]) {
  favorites.value = next
  writeJson(FAVORITES_KEY, next)
}

/** Adds a favorite (newest first). The same calculation is never stored twice. */
export function addFavorite(f: Omit<Favorite, 'id'>): void {
  if (findFavorite(f.mode, f.params)) return
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
  save([{ id, label: f.label, mode: f.mode, params: { ...f.params } }, ...favorites.value].slice(0, MAX_FAVORITES))
}

export function removeFavorite(id: string): void {
  save(favorites.value.filter((f) => f.id !== id))
}

/** A favorite waiting to be opened by the Calculer screen (set from any screen, e.g. Plus › Favoris). */
export const pendingFavorite: Signal<Favorite | null> = signal(null)

export function openFavorite(f: Favorite): void {
  pendingFavorite.value = f
  if (globalThis.location && location.hash !== '#/calculer') location.hash = '#/calculer'
}

/** Puts a just-removed favorite back at its former place (undo). */
export function restoreFavorite(f: Favorite, index: number): void {
  if (favorites.value.some((x) => x.id === f.id) || findFavorite(f.mode, f.params)) return
  const next = [...favorites.value]
  next.splice(Math.max(0, Math.min(index, next.length)), 0, f)
  save(next.slice(0, MAX_FAVORITES))
}
