import type { RuntimeCaching } from 'workbox-build'

/**
 * tarifs.json / tarifs-history.json: NetworkFirst, so the first open after a tariff update already
 * computes with the new fees (stale-while-revalidate showed old fees as "fresh" once). After 3 s
 * without an answer, or offline, the cached copy is used; the app's localStorage copy remains the
 * last resort. `cache: 'reload'` requests (schema-version refetch) bypass the SW and hit the network.
 *
 * urlPattern is serialised as source into dist/sw.js: it must not reference anything outside itself
 * (no module constants, no imports), hence the inline regex.
 */
export const tariffsRuntimeCaching: RuntimeCaching = {
  urlPattern: ({ url, request }) => request.cache !== 'reload' && /^\/tarifs(-history)?\.json$/.test(url.pathname),
  handler: 'NetworkFirst',
  options: { cacheName: 'cr-tarifs', networkTimeoutSeconds: 3, cacheableResponse: { statuses: [200] } },
}
