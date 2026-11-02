// Rasterise public/icons/icon.svg into the PWA PNG icons with Playwright's Chromium.
// Run: node scripts/make-icons.cjs (set PLAYWRIGHT_MODULE to another playwright install if needed)  (outputs are committed; no runtime dependency)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { readFileSync } = require('node:fs')
const path = require('node:path')

const dir = path.join(__dirname, '..', 'public', 'icons')
const svg = readFileSync(path.join(dir, 'icon.svg'), 'utf8')
// Maskable: full-bleed board, artwork scaled into the 80% safe zone.
const maskable = svg
  .replace('<rect width="512" height="512" rx="112" fill="#1c2f86"/>', '<rect width="512" height="512" fill="#1c2f86"/><g transform="translate(51.2 51.2) scale(0.8)">')
  .replace('</svg>', '</g></svg>')

const jobs = [
  ['icon-192.png', svg, 192, true],
  ['icon-512.png', svg, 512, true],
  ['apple-touch-icon.png', maskable, 180, false],
  ['icon-maskable-512.png', maskable, 512, false],
]

;(async () => {
  const browser = await chromium.launch()
  for (const [name, src, size, transparent] of jobs) {
    const page = await browser.newPage({ viewport: { width: size, height: size } })
    await page.setContent(`<html><body style="margin:0;background:transparent">${src.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`)
    await page.screenshot({ path: path.join(dir, name), omitBackground: transparent })
    await page.close()
  }
  await browser.close()
})()
