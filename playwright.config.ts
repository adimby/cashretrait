import { defineConfig, devices } from '@playwright/test'

// PW_CHROMIUM_PATH: use a system Chromium when the browser bundled with Playwright is not installed.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'fr-FR',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Pixel 7'], launchOptions: { executablePath } },
    },
  ],
  webServer: {
    // E2E_SKIP_BUILD=1 reuses an existing dist/.
    command: process.env.E2E_SKIP_BUILD ? 'npx vite preview --port 4173 --strictPort' : 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
