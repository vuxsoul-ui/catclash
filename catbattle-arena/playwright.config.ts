import { defineConfig, devices } from '@playwright/test'

const preferredPort = process.env.E2E_PORT || process.env.PORT || '3000'
const baseURL = (process.env.BASE_URL || `http://127.0.0.1:${preferredPort}`).replace(/\/+$/, '')
const parsedBaseURL = new URL(baseURL)
const isLocalBaseURL = parsedBaseURL.hostname === '127.0.0.1' || parsedBaseURL.hostname === 'localhost'
const localServerPort = parsedBaseURL.port || preferredPort

export default defineConfig({
  testDir: './tests',
  timeout: 120000,
  webServer:
    isLocalBaseURL && process.env.PW_NO_WEBSERVER !== '1'
      ? {
          command: `npm run dev -- --port ${localServerPort}`,
          url: parsedBaseURL.origin,
          reuseExistingServer: false,
          timeout: 120000,
        }
      : undefined,
  use: {
    baseURL,
    storageState: { cookies: [], origins: [] },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium',
      },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
})
