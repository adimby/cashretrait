import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'
import { tariffsRuntimeCaching } from './pwa.config'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// Board colours, kept in sync with src/ui/styles/app.css tokens.
const BOARD = '#1c2f86'
const GROUND = '#e9eef5'

// Admin output: every chunk that holds only /zadmin code is named zadmin-*, so the precache ignores it
// (globIgnores below) and scripts/check-dist.ts exempts it. Shared chunks keep neutral names.
const ADMIN_SRC = /[\\/]src[\\/]admin[\\/]/
const isAdminChunk = (c: { name: string; moduleIds: string[] }) =>
  c.name === 'zadmin' || (c.moduleIds.length > 0 && c.moduleIds.every((id) => ADMIN_SRC.test(id) || id.includes('zadmin')))

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    rollupOptions: {
      input: { index: 'index.html', zadmin: 'zadmin.html' },
      output: {
        entryFileNames: (c) => (isAdminChunk(c) ? 'assets/zadmin-[hash].js' : 'assets/[name]-[hash].js'),
        chunkFileNames: (c) => (isAdminChunk(c) ? 'assets/zadmin-[name]-[hash].js' : 'assets/[name]-[hash].js'),
      },
    },
  },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeManifestIcons: false, // icons are already matched by globPatterns
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
        // Hash-routed app: only the root falls back to the shell, so the admin page and
        // /api/* are never served index.html (and their names never appear in sw.js).
        navigateFallback: '/index.html',
        navigateFallbackAllowlist: [/^\/$/, /^\/index\.html$/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [tariffsRuntimeCaching],
      },
    }),
    {
      // The admin page must not register the service worker nor link the manifest (it is not part of the PWA).
      name: 'zadmin-without-pwa',
      enforce: 'post',
      transformIndexHtml: {
        order: 'post',
        handler: (html, ctx) =>
          /zadmin\.html$/.test(ctx.filename)
            ? html.replace(/<link rel="manifest"[^>]*>/g, '').replace(/<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>/g, '')
            : html,
      },
    },
  ],
})
