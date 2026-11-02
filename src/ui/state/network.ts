import { signal } from '@preact/signals'

/** Browser connectivity, kept current by online/offline events. */
export const online = signal(globalThis.navigator?.onLine ?? true)

if (typeof addEventListener === 'function') {
  addEventListener('online', () => { online.value = true })
  addEventListener('offline', () => { online.value = false })
}

export type TariffStatus = 'fresh' | 'outdated' | 'offline'

/** Header chip: "offline" whenever the device is offline (even if the SW served the data),
 *  "outdated" when online but the last fetch failed and an older copy is shown. */
export function tariffStatus(stale: boolean, isOnline: boolean): TariffStatus {
  if (!isOnline) return 'offline'
  return stale ? 'outdated' : 'fresh'
}
