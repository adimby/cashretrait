import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// Board colours, kept in sync with src/ui/styles/app.css tokens.
const BOARD = '#1c2f86'
const GROUND = '#e9eef5'

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'CashRetrait',
        short_name: 'CashRetrait',
        description: 'Le moins cher pour retirer et envoyer avec MVola, Airtel Money et Orange Money. Calcul indicatif, application indépendante.',
        lang: 'fr',
        start_url: '/#/calculer',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: BOARD,
        background_color: GROUND,
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // App shell only. Tariff JSON is runtime-cached (below); the admin is never cached.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,txt}'],
        globIgnores: ['**/zadmin*', '**/zadmin/**', '**/api/**', '**/tarifs*.json'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/zadmin/, /^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // `cache: 'reload'` requests (schema-version refetch) bypass the SW and hit the network.
            urlPattern: ({ url, request }) =>
              request.cache !== 'reload' && /^\/tarifs(-history)?\.json$/.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'cr-tarifs', cacheableResponse: { statuses: [200] } },
          },
        ],
      },
    }),
  ],
})
