import path from 'node:path'

import { defineConfig, devices } from '@playwright/test'

const app = process.env.E2E_APP ?? 'main'

const appConfig = {
  main: {
    cmd: 'cross-env PORT=3100 yarn workspace @groupher/frontend-main dev',
    url: 'http://localhost:3100',
    testDir: path.resolve('frontend/e2e/tests/main'),
  },
  dashboard: {
    cmd: 'cross-env PORT=3101 yarn workspace @groupher/frontend-dashboard dev',
    url: 'http://localhost:3101',
    testDir: path.resolve('frontend/e2e/tests/dashboard'),
  },
  landing: {
    cmd: 'cross-env PORT=3102 yarn workspace @groupher/frontend-landing dev',
    url: 'http://localhost:3102',
    testDir: path.resolve('frontend/e2e/tests/landing'),
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
      // We run multiple Next apps on the same localhost URL in this monorepo.
      // Reusing an already-running server can accidentally run tests against the wrong app.
      reuseExistingServer: false,
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
