import { signal, type Signal } from '@preact/signals'
import { TariffsSchema, type Tariffs } from '../../tariffs/schema'
import { diffTariffs, type FeeChange } from '../../tariffs/validate'
import { readJson, writeJson } from './storage'

export const LAST_SEEN_KEY = 'cr.lastSeen'

/** The tariffs the user last acknowledged (localStorage 'cr.lastSeen'), or null. */
export function readLastSeen(): Tariffs | null {
  const r = TariffsSchema.safeParse(readJson(LAST_SEEN_KEY))
  return r.success ? r.data : null
}

export const lastSeen: Signal<Tariffs | null> = signal(readLastSeen())

/** Fee changes since the last acknowledged tariffs; [] on a first visit (lastSeen null). */
export function pendingChanges(current: Tariffs, seen: Tariffs | null): FeeChange[] {
  if (!seen) return []
  return diffTariffs(seen, current)
}

export function markSeen(t: Tariffs): void {
  lastSeen.value = t
  writeJson(LAST_SEEN_KEY, t)
}
