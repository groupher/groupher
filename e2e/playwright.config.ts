import { defineConfig, devices } from '@playwright/test'

const app = process.env.E2E_APP ?? 'main'

const appConfig = {
  main: { cmd: 'yarn dev:main', url: 'http://localhost:3000', testDir: './tests/main' },
  dashboard: {
    cmd: 'yarn dev:dashboard',
    url: 'http://localhost:3000',
    testDir: './tests/dashboard',
  },
  landing: {
    cmd: 'yarn dev:landing',
    url: 'http://localhost:3000',
    testDir: './tests/landing',
  },
} as const

if (!(app in appConfig)) {
  throw new Error(`Unknown E2E_APP: ${app}. Expected one of: ${Object.keys(appConfig).join(', ')}`)
}

const { cmd, url, testDir } = appConfig[app as keyof typeof appConfig]

export default defineConfig({
  testDir,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list'], ['html']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? url,
    trace: 'on-first-retry',
  },

  webServer: [
    {
      command: 'yarn mock:server',
      url: `http://localhost:${process.env.MOCK_GRAPHQL_PORT ?? '4001'}/health`,
      // Avoid reusing a stale local mock server (it can mask changes in mocks).
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: cmd,
      url,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
