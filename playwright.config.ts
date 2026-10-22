import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:4173' },
  webServer: { command: 'npm run build && npx vite preview --port 4173', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 120_000 },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
})
