import { signal, type Signal } from '@preact/signals'
import { TariffsSchema, SCHEMA_VERSION, type Tariffs } from '../../tariffs/schema'
import { readJson, writeJson } from './storage'

const CACHE_KEY = 'cr.tariffs'
const URL_TARIFFS = '/tarifs.json'
const URL_HISTORY = '/tarifs-history.json'

export const tariffs: Signal<Tariffs | null> = signal(null)
/** true when the shown tariffs come from the last valid copy because the network failed. */
export const tariffsStale: Signal<boolean> = signal(false)

async function getJson(fetchImpl: typeof fetch, init?: RequestInit): Promise<unknown> {
  const r = await fetchImpl(URL_TARIFFS, init)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

function lastValid(): Tariffs | null {
  const r = TariffsSchema.safeParse(readJson(CACHE_KEY))
  return r.success ? r.data : null
}

/** Fetch tarifs.json. A response from an older/newer schema is refetched bypassing caches
 *  (`cache: 'reload'`, which the service worker also lets through). If that still fails,
 *  the last valid copy is returned with `stale: true`; with no copy at all, it throws. */
export async function loadTariffs(fetchImpl: typeof fetch = fetch): Promise<{ tariffs: Tariffs; stale: boolean }> {
  try {
    let data = await getJson(fetchImpl)
    if ((data as { schemaVersion?: unknown } | null)?.schemaVersion !== SCHEMA_VERSION) {
      data = await getJson(fetchImpl, { cache: 'reload' })
    }
    const fresh = TariffsSchema.parse(data)
    writeJson(CACHE_KEY, fresh)
    tariffs.value = fresh
    tariffsStale.value = false
    return { tariffs: fresh, stale: false }
  } catch (err) {
    const cached = tariffs.value ?? lastValid()
    if (!cached) throw err
    tariffs.value = cached
    tariffsStale.value = true
    return { tariffs: cached, stale: true }
  }
}

/** tarifs-history.json is generated at build time and may be absent: any failure → null. */
export async function loadHistory(fetchImpl: typeof fetch = fetch): Promise<unknown | null> {
  try {
    const r = await fetchImpl(URL_HISTORY)
    return r.ok ? await r.json() : null
  } catch {
    return null
  }
}
