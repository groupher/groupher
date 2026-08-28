import path from 'node:path'

import { defineConfig, devices } from '@playwright/test'

const app = process.env.E2E_APP ?? 'dash'
const useSystemChrome = process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === '1'
const mockGraphQLEndpoint = `http://localhost:${process.env.MOCK_GRAPHQL_PORT ?? '4001'}/graphiql`
const repoRoot = path.resolve(__dirname, '../..')

type TWebServer = {
  command: string
  cwd: string
  reuseExistingServer: boolean
  timeout: number
  url: string
}

const appConfig = {
  dash: {
    cmd: `pnpm exec cross-env PORT=3103 GRAPHQL_ENDPOINT=${mockGraphQLEndpoint} pnpm --filter @groupher/frontend-dash run dev`,
    url: 'http://dash.groupher.localhost:3103',
    testDir: path.join(repoRoot, 'frontend/e2e/tests/dash'),
  },
  landing: {
    cmd: 'pnpm exec cross-env PORT=3102 pnpm --filter @groupher/frontend-landing run dev',
    url: 'http://localhost:3102',
    testDir: path.join(repoRoot, 'frontend/e2e/tests/landing'),
  },
  auth: {
    cmd: '',
    url: 'http://dash.groupher.localhost:3103',
    testDir: path.join(repoRoot, 'frontend/e2e/tests/auth'),
  },
} as const

if (!(app in appConfig)) {
  throw new Error(`Unknown E2E_APP: ${app}. Expected one of: ${Object.keys(appConfig).join(', ')}`)
}

const { cmd, url, testDir } = appConfig[app as keyof typeof appConfig]
const authStack = app === 'auth'
const authHostResolverRules = [
  'MAP dash.groupher.localhost 127.0.0.1',
  'MAP auth.groupher.localhost 127.0.0.1',
].join(',')
const webServer: TWebServer[] = authStack
  ? [
      {
        command: 'pnpm exec cross-env MOCK_GRAPHQL_PORT=4104 E2E_AUTH_STACK=1 pnpm run mock:server',
        cwd: repoRoot,
        url: 'http://localhost:4104/health',
        reuseExistingServer: false,
        timeout: 120_000,
      },
      {
        command:
          'pnpm exec cross-env NODE_ENV=test PORT=3104 AUTH_URL=http://auth.groupher.localhost:3104 AUTH_COOKIE_SECURE=true AUTH_COOKIE_DOMAIN=.groupher.localhost NEXTAUTH_SECRET=e2e-auth-secret-e2e-auth-secret SERVICE_AUTH_CLIENT_ID=auth-e2e SERVICE_AUTH_CLIENT_SECRET=e2e-secret SERVICE_AUTH_TOKEN_ENDPOINT=http://127.0.0.1:4104/oauth2/token PHOENIX_GRAPHQL_ENDPOINT=http://127.0.0.1:4104/graphiql AUTH_TEST_ALLOWED_ORIGINS=http://dash.groupher.localhost:3103 pnpm --filter @groupher/backend-auth exec tsx src/e2e/server.ts',
        cwd: repoRoot,
        url: 'http://localhost:3104/health',
        reuseExistingServer: false,
        timeout: 120_000,
      },
      {
        command:
          'pnpm exec cross-env PORT=3103 GRAPHQL_ENDPOINT=http://127.0.0.1:4104/graphiql NEXT_PUBLIC_AUTH_ENDPOINT=http://auth.groupher.localhost:3104/api/auth E2E_AUTH_STACK=1 pnpm --filter @groupher/frontend-dash run dev',
        cwd: repoRoot,
        url: 'http://localhost:3103/health',
        reuseExistingServer: false,
        timeout: 120_000,
      },
    ]
  : [
      {
        command: 'pnpm run mock:server',
        cwd: repoRoot,
        url: `http://localhost:${process.env.MOCK_GRAPHQL_PORT ?? '4001'}/health`,
        // Avoid reusing a stale local mock server (it can mask changes in mocks).
        reuseExistingServer: false,
        timeout: 120_000,
      },
      {
        command: cmd,
        cwd: repoRoot,
        url,
        // Reusing an already-running server can accidentally run tests against the wrong app.
        reuseExistingServer: false,
        timeout: 120_000,
      },
    ]

export default defineConfig({
  testDir,
  timeout: authStack ? 60_000 : 30_000,
  outputDir: path.join(repoRoot, '.playwright/test-results'),
  fullyParallel: !authStack,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: authStack ? 1 : process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: '.playwright/report' }]]
    : [['list'], ['html', { outputFolder: '.playwright/report' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? url,
    trace: 'on-first-retry',
  },

  webServer,

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(useSystemChrome ? { channel: 'chrome' } : {}),
        ...(authStack
          ? {
              launchOptions: {
                args: [`--host-resolver-rules=${authHostResolverRules}`],
              },
            }
          : {}),
      },
    },
  ],
})
