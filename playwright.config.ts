import { defineConfig } from '@playwright/test'

const baseURL = process.env.BASE_URL ?? 'http://localhost:4173/'

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: { baseURL, viewport: { width: 1600, height: 950 } },
  webServer: process.env.BASE_URL
    ? undefined
    : { command: 'npm run build && npx vite preview --port 4173 --strictPort', url: baseURL, reuseExistingServer: true, timeout: 120_000 },
})
