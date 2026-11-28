import path from 'node:path'

import { defineConfig, devices } from '@playwright/test'

import { registryRoot } from '../../local/dev-hub/src/server/storage-paths'
import { assertLegacyE2ECheckout } from './checkout-guard'

const app = process.env.E2E_APP ?? 'dash'
const useSystemChrome = process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === '1'
const browserChannel = useSystemChrome ? 'chrome' : 'chromium'
const mockGraphQLEndpoint = `http://localhost:${process.env.MOCK_GRAPHQL_PORT ?? '4001'}/graphiql`
const dashPort = process.env.DASH_E2E_PORT ?? '3103'
const repoRoot = path.resolve(__dirname, '../..')
assertLegacyE2ECheckout(repoRoot, registryRoot())

type TWebServer = {
  command: string
  cwd: string
  env?: Record<string, string>
  gracefulShutdown: {
    signal: 'SIGINT'
    timeout: number
  }
  reuseExistingServer: boolean
  stdout?: 'pipe' | 'ignore'
  timeout: number
  url: string
}

// Let pnpm/Vite process trees close inherited stdio before Playwright falls back to SIGKILL.
const gracefulShutdown = {
  signal: 'SIGINT' as const,
  timeout: 5_000,
}

const appDevCommand = (packageName: string) =>
  `pnpm --filter ${packageName} run ${process.env.CI ? 'dev:managed' : 'dev'}`

const webServerCommand = (command: string) =>
  process.env.CI
    ? {
        command: 'exec node frontend/e2e/ci-web-server.mjs',
        env: { E2E_SERVER_COMMAND: command },
        stdout: 'pipe' as const,
      }
    : { command }

const appConfig = {
  dash: {
    cmd: `pnpm exec cross-env E2E_AUTH_STACK=1 PORT=${dashPort} GRAPHQL_ENDPOINT=${mockGraphQLEndpoint} PHOENIX_GRAPHQL_ENDPOINT=${mockGraphQLEndpoint} ${appDevCommand('@groupher/frontend-dash')}`,
    url: `http://dash.groupher.localhost:${dashPort}`,
    testDir: path.join(repoRoot, 'frontend/e2e/tests/dash'),
  },
  landing: {
    cmd: `pnpm exec cross-env PORT=3102 ${appDevCommand('@groupher/frontend-landing')}`,
    url: 'http://localhost:3102',
    testDir: path.join(repoRoot, 'frontend/e2e/tests/landing'),
  },
  auth: {
    cmd: '',
    url: 'http://dash.groupher.localhost:3103',
    testDir: path.join(repoRoot, 'frontend/e2e/tests/auth'),
  },
  'community-ssr': {
    cmd: `pnpm exec cross-env E2E_AUTH_STACK=1 PORT=3107 GRAPHQL_ENDPOINT=${mockGraphQLEndpoint} PHOENIX_GRAPHQL_ENDPOINT=${mockGraphQLEndpoint} pnpm --filter @groupher/frontend-community run dev:managed`,
    url: 'http://127.0.0.1:3107/health',
    testDir: path.join(repoRoot, 'frontend/e2e/tests/community-ssr'),
  },
  community: {
    cmd: `pnpm exec cross-env E2E_AUTH_STACK=1 PORT=3107 GRAPHQL_ENDPOINT=http://127.0.0.1:4001/graphiql PHOENIX_GRAPHQL_ENDPOINT=http://127.0.0.1:4001/graphiql ${appDevCommand('@groupher/frontend-community')}`,
    url: 'http://community.groupher.localhost:3107/home/post',
    testDir: path.join(repoRoot, 'frontend/e2e/tests/community'),
  },
} as const

if (!(app in appConfig)) {
  throw new Error(`Unknown E2E_APP: ${app}. Expected one of: ${Object.keys(appConfig).join(', ')}`)
}

const { cmd, url, testDir } = appConfig[app as keyof typeof appConfig]
const authStack = app === 'auth'
const mockServerCommand = (port: string, auth = false) => {
  const env = `MOCK_GRAPHQL_PORT=${port}${auth ? ' E2E_AUTH_STACK=1' : ''}`
  const server =
    process.env.CI || app === 'community-ssr'
      ? 'pnpm --filter @groupher/mock-server run start'
      : 'pnpm run mock:server'
  return `pnpm exec cross-env ${env} ${server}`
}
const authHostResolverRules = [
  'MAP dash.groupher.localhost 127.0.0.1',
  'MAP auth.groupher.localhost 127.0.0.1',
  'MAP community.groupher.localhost 127.0.0.1',
].join(',')
const communityStack = app === 'community'
const webServer: TWebServer[] = communityStack
  ? [
      {
        ...webServerCommand('cd backend/api && MIX_ENV=dev mix phx.server'),
        cwd: repoRoot,
        gracefulShutdown,
        url: 'http://127.0.0.1:4001/health',
        reuseExistingServer: true,
        timeout: 120_000,
      },
      {
        ...webServerCommand(cmd),
        cwd: repoRoot,
        gracefulShutdown,
        url,
        reuseExistingServer: false,
        timeout: 120_000,
      },
    ]
  : authStack
    ? [
        {
          ...webServerCommand(mockServerCommand('4104', true)),
          cwd: repoRoot,
          gracefulShutdown,
          url: 'http://localhost:4104/health',
          reuseExistingServer: false,
          timeout: 120_000,
        },
        {
          ...webServerCommand(
            'pnpm exec cross-env NODE_ENV=test E2E_AUTH_STACK=1 AUTH_GITHUB_ID=e2e-github AUTH_GITHUB_SECRET=e2e-github-secret PORT=3104 AUTH_URL=http://auth.groupher.localhost:3104 AUTH_COOKIE_SECURE=true AUTH_COOKIE_DOMAIN=.groupher.localhost NEXTAUTH_SECRET=e2e-auth-secret-e2e-auth-secret SERVICE_AUTH_CLIENT_ID=auth-e2e SERVICE_AUTH_CLIENT_SECRET=e2e-secret SERVICE_AUTH_TOKEN_ENDPOINT=http://127.0.0.1:4104/oauth2/token PHOENIX_GRAPHQL_ENDPOINT=http://127.0.0.1:4104/graphiql AUTH_TEST_ALLOWED_ORIGINS=http://dash.groupher.localhost:3103,http://community.groupher.localhost:3107 pnpm --filter @groupher/backend-auth exec tsx src/e2e/server.ts',
          ),
          cwd: repoRoot,
          gracefulShutdown,
          url: 'http://localhost:3104/health',
          reuseExistingServer: false,
          timeout: 120_000,
        },
        {
          ...webServerCommand(
            `pnpm exec cross-env PORT=3103 GRAPHQL_ENDPOINT=http://127.0.0.1:4104/graphiql PHOENIX_GRAPHQL_ENDPOINT=http://127.0.0.1:4104/graphiql SERVICE_AUTH_CLIENT_ID=publisher-e2e SERVICE_AUTH_CLIENT_SECRET=e2e-secret SERVICE_AUTH_TOKEN_ENDPOINT=http://127.0.0.1:4104/oauth2/token NEXT_PUBLIC_AUTH_ENDPOINT=http://auth.groupher.localhost:3104/api/auth E2E_AUTH_STACK=1 ${appDevCommand('@groupher/frontend-dash')}`,
          ),
          cwd: repoRoot,
          gracefulShutdown,
          url: 'http://localhost:3103/health',
          reuseExistingServer: false,
          timeout: 120_000,
        },
        {
          ...webServerCommand(
            `pnpm exec cross-env PORT=3107 GRAPHQL_ENDPOINT=http://127.0.0.1:4104/graphiql NEXT_PUBLIC_AUTH_ENDPOINT=http://auth.groupher.localhost:3104/api/auth E2E_AUTH_STACK=1 ${appDevCommand('@groupher/frontend-community')}`,
          ),
          cwd: repoRoot,
          gracefulShutdown,
          url: 'http://127.0.0.1:3107/health',
          reuseExistingServer: false,
          timeout: 120_000,
        },
      ]
    : [
        {
          ...webServerCommand(mockServerCommand(process.env.MOCK_GRAPHQL_PORT ?? '4001')),
          cwd: repoRoot,
          gracefulShutdown,
          url: `http://localhost:${process.env.MOCK_GRAPHQL_PORT ?? '4001'}/health`,
          // Avoid reusing a stale local mock server (it can mask changes in mocks).
          reuseExistingServer: false,
          timeout: 120_000,
        },
        {
          ...webServerCommand(cmd),
          cwd: repoRoot,
          gracefulShutdown,
          url: app === 'dash' ? `http://127.0.0.1:${dashPort}/health` : url,
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
        // Use real Chromium's new headless mode instead of chrome-headless-shell, which can hang on CI teardown.
        channel: browserChannel,
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
