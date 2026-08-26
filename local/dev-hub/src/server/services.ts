import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type {
  TMetricThresholds,
  TServiceGroup,
  TServiceRelation,
  TServiceReadiness,
  TServiceStartPolicy,
  TTechnologyStack,
} from '../shared/contracts.ts'
import { LOCAL_SERVICE_ENDPOINTS, LOCAL_SERVICE_GRAPHQL_ENDPOINTS } from './service-endpoints.ts'

export type TServiceConfigDefinition =
  | {
      kind: 'env-files'
      root: string
      environment: 'development'
    }
  | {
      kind: 'next-env'
      root: string
      environment: 'development'
    }
  | {
      kind: 'elixir-config'
      root: string
      environment: string
    }
  | {
      kind: 'python-settings'
      root: string
      files: readonly string[]
      environmentKeys: readonly string[]
    }

export type TServiceDefinition = {
  id: string
  name: string
  description: string
  group: TServiceGroup
  monogram: string
  technologies?: TTechnologyStack
  cwd: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  config?: TServiceConfigDefinition
  port?: number
  url?: string
  appUrl?: string
  readiness?: TServiceReadiness
  portlessName?: string
  portlessUrl?: string
  portlessAppUrl?: string
  endpoints?: Array<{
    id: string
    label: string
    port?: number
    url?: string
    appUrl?: string
    portlessName?: string
    portlessUrl?: string
    portlessAppUrl?: string
  }>
  unavailableReason?: string
  metrics: TMetricThresholds
  browserMetrics?: boolean
  browserMetricOrigins?: readonly string[]
  startPolicy?: Partial<TServiceStartPolicy>
}

export const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url))
const fromRoot = (...parts: string[]): string => path.join(REPO_ROOT, ...parts)
const converterPythonExecutable = fromRoot('backend/document-converter/.venv/bin/python')
const MB = 1024 * 1024
const FRONTEND_METRICS: TMetricThresholds = {
  serverCpuPercent: 90,
  serverRssBytes: 1_536 * MB,
  browserBusyPercent: 50,
  browserHeapBytes: 512 * MB,
}
const BACKEND_METRICS: TMetricThresholds = {
  serverCpuPercent: 100,
  serverRssBytes: 1_536 * MB,
  browserBusyPercent: 50,
  browserHeapBytes: 512 * MB,
}

const APP_CHAIN_POLICY = {
  defaultMode: 'chain',
  requiredDependencies: ['gateway', 'auth', 'phoenix'],
  optionalDependencies: ['document-converter'],
} satisfies TServiceStartPolicy

const DASHBOARD_CHAIN_POLICY = {
  ...APP_CHAIN_POLICY,
  optionalDependencies: ['assets-hub', 'content-import', 'document-converter'],
} satisfies TServiceStartPolicy

const APPLY_CHAIN_POLICY = {
  defaultMode: 'chain',
  requiredDependencies: ['gateway', 'auth', 'phoenix', 'assets-hub'],
  optionalDependencies: [],
} satisfies TServiceStartPolicy

const LANDING_CHAIN_POLICY = {
  defaultMode: 'chain',
  requiredDependencies: ['gateway'],
  optionalDependencies: [],
} satisfies TServiceStartPolicy

const COMMUNITY_CHAIN_POLICY = {
  defaultMode: 'chain',
  requiredDependencies: ['phoenix'],
  optionalDependencies: [],
} satisfies TServiceStartPolicy

export const SERVICE_DEFINITIONS: TServiceDefinition[] = [
  {
    id: 'gateway',
    name: 'Dev Gateway',
    description: 'Local-only routing entry',
    group: 'backend',
    monogram: 'GW',
    technologies: ['hono', 'nodejs', 'typescript', 'routing'],
    cwd: REPO_ROOT,
    config: {
      kind: 'env-files',
      root: fromRoot('infra/gateway'),
      environment: 'development',
    },
    command: 'make',
    args: ['be.gateway.start'],
    env: {
      PORT: '3003',
      NEXT_PUBLIC_SITE_URL: 'https://groupher.localhost',
      LANDING_SITE: LOCAL_SERVICE_ENDPOINTS.landing,
      MAIN_SITE: LOCAL_SERVICE_ENDPOINTS.main,
      DASHBOARD_SITE: LOCAL_SERVICE_ENDPOINTS.dashboard,
      DASH_SITE: LOCAL_SERVICE_ENDPOINTS.dash,
      APPLY_SITE: LOCAL_SERVICE_ENDPOINTS.apply,
      AUTH_SITE: LOCAL_SERVICE_ENDPOINTS.auth,
      API_SITE: LOCAL_SERVICE_ENDPOINTS.phoenix,
      PRESS_SITE: LOCAL_SERVICE_ENDPOINTS.press,
    },
    port: 3003,
    url: 'http://127.0.0.1:3003/health',
    appUrl: 'http://127.0.0.1:3003/',
    portlessName: 'groupher',
    portlessUrl: 'https://groupher.localhost/health',
    portlessAppUrl: 'https://groupher.localhost/',
    metrics: BACKEND_METRICS,
    browserMetrics: true,
  },
  {
    id: 'auth',
    name: 'Auth',
    description: 'OAuth and browser session boundary',
    group: 'backend',
    monogram: 'AU',
    technologies: ['hono', 'authjs', 'typescript', 'oauth'],
    cwd: REPO_ROOT,
    config: {
      kind: 'env-files',
      root: fromRoot('backend/auth'),
      environment: 'development',
    },
    command: 'make',
    args: ['be.auth.start'],
    env: {
      PORT: '3004',
      AUTH_URL: 'https://auth.groupher.localhost',
      PHOENIX_GRAPHQL_ENDPOINT: LOCAL_SERVICE_GRAPHQL_ENDPOINTS.phoenix,
      AUTH_COOKIE_DOMAIN: '.groupher.localhost',
      SERVICE_AUTH_ISSUER: LOCAL_SERVICE_ENDPOINTS.auth,
      SERVICE_AUTH_JWKS_URL: `${LOCAL_SERVICE_ENDPOINTS.auth}/.well-known/jwks.json`,
      SERVICE_AUTH_TOKEN_ENDPOINT: `${LOCAL_SERVICE_ENDPOINTS.auth}/oauth2/token`,
    },
    port: 3004,
    url: 'http://127.0.0.1:3004/health',
    portlessName: 'auth',
    portlessUrl: 'https://auth.groupher.localhost/health',
    metrics: BACKEND_METRICS,
    browserMetrics: true,
  },
  {
    id: 'landing',
    name: 'Landing',
    description: 'Public marketing site',
    group: 'frontend',
    monogram: 'LD',
    technologies: ['tanstack-start', 'react', 'typescript', 'tailwindcss'],
    cwd: REPO_ROOT,
    config: {
      kind: 'env-files',
      root: fromRoot('frontend/landing'),
      environment: 'development',
    },
    command: 'make',
    args: ['fe.dev.landing'],
    port: 3002,
    url: 'http://127.0.0.1:3002/health',
    appUrl: 'http://127.0.0.1:3002/',
    portlessName: 'landing',
    portlessUrl: 'https://landing.groupher.localhost/health',
    portlessAppUrl: 'https://landing.groupher.localhost/',
    metrics: FRONTEND_METRICS,
    startPolicy: LANDING_CHAIN_POLICY,
  },
  {
    id: 'main',
    name: 'Main',
    description: 'Community-facing application',
    group: 'frontend',
    monogram: 'MN',
    technologies: ['nextjs', 'react', 'typescript', 'tailwindcss'],
    cwd: REPO_ROOT,
    config: {
      kind: 'next-env',
      root: fromRoot('frontend/main'),
      environment: 'development',
    },
    command: 'make',
    args: ['fe.dev.main'],
    port: 3000,
    url: 'http://127.0.0.1:3000/health',
    appUrl: 'http://127.0.0.1:3000/home',
    portlessName: 'main',
    portlessUrl: 'https://main.groupher.localhost/health',
    portlessAppUrl: 'https://main.groupher.localhost/home',
    metrics: FRONTEND_METRICS,
    startPolicy: APP_CHAIN_POLICY,
  },
  {
    id: 'community',
    name: 'Community',
    description: 'TanStack Start public community application',
    group: 'frontend',
    monogram: 'CM',
    technologies: ['tanstack-start', 'react', 'typescript', 'tailwindcss'],
    cwd: REPO_ROOT,
    config: {
      kind: 'env-files',
      root: fromRoot('frontend/community'),
      environment: 'development',
    },
    command: 'yarn',
    args: ['dev:community'],
    env: {
      GRAPHQL_ENDPOINT: LOCAL_SERVICE_GRAPHQL_ENDPOINTS.phoenix,
      NEXT_PUBLIC_AUTH_ENDPOINT: `${LOCAL_SERVICE_ENDPOINTS.auth}/api/auth`,
    },
    port: 3007,
    url: 'http://127.0.0.1:3007/health',
    appUrl: 'http://127.0.0.1:3007/home/about',
    portlessName: 'community',
    portlessUrl: 'https://community.groupher.localhost/health',
    portlessAppUrl: 'https://community.groupher.localhost/home/about',
    metrics: FRONTEND_METRICS,
    startPolicy: COMMUNITY_CHAIN_POLICY,
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Community administration workspace',
    group: 'frontend',
    monogram: 'DS',
    technologies: ['nextjs', 'react', 'typescript', 'tailwindcss'],
    cwd: REPO_ROOT,
    config: {
      kind: 'next-env',
      root: fromRoot('frontend/dashboard'),
      environment: 'development',
    },
    command: 'make',
    args: ['fe.dev.dsb'],
    env: {
      NEXT_PUBLIC_ASSETS_HUB_ENDPOINT: 'https://assets-hub.groupher.localhost',
      NEXT_PUBLIC_ASSETS_HUB_READ_ENDPOINT: 'https://assets.groupher.localhost',
      CONTENT_IMPORT_APP_ENDPOINT: LOCAL_SERVICE_ENDPOINTS.contentImport,
      SERVICE_AUTH_ISSUER: LOCAL_SERVICE_ENDPOINTS.auth,
      SERVICE_AUTH_JWKS_URL: `${LOCAL_SERVICE_ENDPOINTS.auth}/.well-known/jwks.json`,
      SERVICE_AUTH_TOKEN_ENDPOINT: `${LOCAL_SERVICE_ENDPOINTS.auth}/oauth2/token`,
    },
    port: 3001,
    url: 'http://127.0.0.1:3001/health',
    appUrl: 'http://127.0.0.1:3001/home',
    portlessName: 'dashboard',
    portlessUrl: 'https://dashboard.groupher.localhost/health',
    portlessAppUrl: 'https://dashboard.groupher.localhost/home',
    browserMetricOrigins: [
      'http://dashboard.groupher.localhost:3001',
      'https://dashboard.groupher.localhost',
    ],
    metrics: FRONTEND_METRICS,
    startPolicy: DASHBOARD_CHAIN_POLICY,
  },
  {
    id: 'dash',
    name: 'Dash',
    description: 'TanStack Start community administration workspace',
    group: 'frontend',
    monogram: 'DX',
    technologies: ['tanstack-start', 'react', 'typescript', 'tailwindcss'],
    cwd: REPO_ROOT,
    config: {
      kind: 'env-files',
      root: fromRoot('frontend/dash'),
      environment: 'development',
    },
    command: 'make',
    args: ['fe.dev.dash'],
    env: {
      NEXT_PUBLIC_ASSETS_HUB_ENDPOINT: 'https://assets-hub.groupher.localhost',
      NEXT_PUBLIC_ASSETS_HUB_READ_ENDPOINT: 'https://assets.groupher.localhost',
      CONTENT_IMPORT_APP_ENDPOINT: LOCAL_SERVICE_ENDPOINTS.contentImport,
      SERVICE_AUTH_ISSUER: LOCAL_SERVICE_ENDPOINTS.auth,
      SERVICE_AUTH_JWKS_URL: `${LOCAL_SERVICE_ENDPOINTS.auth}/.well-known/jwks.json`,
      SERVICE_AUTH_TOKEN_ENDPOINT: `${LOCAL_SERVICE_ENDPOINTS.auth}/oauth2/token`,
    },
    port: 3005,
    url: 'http://127.0.0.1:3005/health',
    appUrl: 'http://127.0.0.1:3005/home/overview',
    portlessName: 'dash',
    portlessUrl: 'https://dash.groupher.localhost/health',
    portlessAppUrl: 'https://dash.groupher.localhost/home/overview',
    metrics: FRONTEND_METRICS,
    startPolicy: DASHBOARD_CHAIN_POLICY,
  },
  {
    id: 'apply',
    name: 'Apply',
    description: 'Community application and global review workspace',
    group: 'frontend',
    monogram: 'AP',
    technologies: ['tanstack-start', 'react', 'typescript', 'tailwindcss'],
    cwd: REPO_ROOT,
    config: {
      kind: 'env-files',
      root: fromRoot('frontend/apply'),
      environment: 'development',
    },
    command: 'make',
    args: ['fe.dev.apply'],
    env: {
      ASSETS_HUB_ENDPOINT: 'https://assets-hub.groupher.localhost',
    },
    port: 3006,
    url: 'http://127.0.0.1:3006/apply/health',
    appUrl: 'http://127.0.0.1:3003/apply',
    portlessName: 'apply',
    portlessUrl: 'https://apply.groupher.localhost/apply/health',
    portlessAppUrl: 'https://groupher.localhost/apply',
    browserMetricOrigins: ['http://groupher.localhost:3003', 'https://groupher.localhost'],
    metrics: FRONTEND_METRICS,
    startPolicy: APPLY_CHAIN_POLICY,
  },
  {
    id: 'inspire-me',
    name: 'Inspire Me',
    description: 'Local feedback research library',
    group: 'frontend',
    monogram: 'IN',
    technologies: ['nextjs', 'react', 'typescript', 'tailwindcss'],
    cwd: REPO_ROOT,
    config: {
      kind: 'next-env',
      root: fromRoot('frontend/inspire-me'),
      environment: 'development',
    },
    command: 'yarn',
    args: ['workspace', '@groupher/inspire-me', 'dev', '-p', '3010'],
    port: 3010,
    url: 'http://127.0.0.1:3010/health',
    appUrl: 'http://127.0.0.1:3010/',
    portlessName: 'inspire-me',
    portlessUrl: 'https://inspire-me.groupher.localhost/health',
    portlessAppUrl: 'https://inspire-me.groupher.localhost/',
    metrics: FRONTEND_METRICS,
  },
  {
    id: 'phoenix',
    name: 'Phoenix',
    description: 'GraphQL API in mock mode',
    group: 'backend',
    monogram: 'PX',
    technologies: ['phoenix', 'elixir', 'absinthe', 'postgresql'],
    cwd: REPO_ROOT,
    config: {
      kind: 'elixir-config',
      root: fromRoot('backend/api/config'),
      environment: 'mock',
    },
    command: 'make',
    args: ['be.start'],
    port: 4001,
    url: 'http://127.0.0.1:4001/health',
    portlessName: 'api',
    portlessUrl: 'https://api.groupher.localhost/health',
    env: {
      SERVICE_AUTH_ISSUER: LOCAL_SERVICE_ENDPOINTS.auth,
      SERVICE_AUTH_JWKS_URL: `${LOCAL_SERVICE_ENDPOINTS.auth}/.well-known/jwks.json`,
      SERVICE_AUTH_TOKEN_ENDPOINT: `${LOCAL_SERVICE_ENDPOINTS.auth}/oauth2/token`,
    },
    metrics: BACKEND_METRICS,
  },
  {
    id: 'content-import',
    name: 'Content Import',
    description: 'External source import orchestration',
    group: 'backend',
    monogram: 'CI',
    technologies: ['hono', 'nodejs', 'typescript', 'graphql'],
    cwd: REPO_ROOT,
    config: {
      kind: 'env-files',
      root: fromRoot('backend/content-import'),
      environment: 'development',
    },
    command: 'make',
    args: ['be.content-import.start'],
    env: {
      DOCUMENT_CONVERTER_APP_ENDPOINT: LOCAL_SERVICE_ENDPOINTS.documentConverter,
      PHOENIX_GRAPHQL_ENDPOINT: LOCAL_SERVICE_GRAPHQL_ENDPOINTS.phoenix,
      PORT: '8001',
      SERVICE_AUTH_ISSUER: LOCAL_SERVICE_ENDPOINTS.auth,
      SERVICE_AUTH_JWKS_URL: `${LOCAL_SERVICE_ENDPOINTS.auth}/.well-known/jwks.json`,
      SERVICE_AUTH_TOKEN_ENDPOINT: `${LOCAL_SERVICE_ENDPOINTS.auth}/oauth2/token`,
    },
    port: 8001,
    url: 'http://127.0.0.1:8001/health',
    portlessName: 'content-import',
    portlessUrl: 'https://content-import.groupher.localhost/health',
    metrics: BACKEND_METRICS,
  },
  {
    id: 'press',
    name: 'Press',
    description: 'Public Markdown, Feed, Agent and SEO output service',
    group: 'backend',
    monogram: 'PR',
    technologies: ['hono', 'nodejs', 'typescript', 'postgresql'],
    cwd: REPO_ROOT,
    config: {
      kind: 'env-files',
      root: fromRoot('backend/press'),
      environment: 'development',
    },
    command: 'make',
    args: ['be.press.start'],
    env: {
      DB_HOST: 'localhost',
      DB_NAME: 'groupher_server_mock',
      DB_PASSWORD: 'postgres',
      DB_PORT: '5432',
      DB_USERNAME: 'postgres',
      PHOENIX_GRAPHQL_ENDPOINT: LOCAL_SERVICE_GRAPHQL_ENDPOINTS.phoenix,
      PORT: '8003',
      SERVICE_AUTH_ISSUER: LOCAL_SERVICE_ENDPOINTS.auth,
      SERVICE_AUTH_JWKS_URL: `${LOCAL_SERVICE_ENDPOINTS.auth}/.well-known/jwks.json`,
      SERVICE_AUTH_TOKEN_ENDPOINT: `${LOCAL_SERVICE_ENDPOINTS.auth}/oauth2/token`,
    },
    port: 8003,
    url: 'http://127.0.0.1:8003/health',
    portlessName: 'press',
    portlessUrl: 'https://press.groupher.localhost/health',
    metrics: BACKEND_METRICS,
    startPolicy: {
      defaultMode: 'chain',
      requiredDependencies: ['phoenix'],
      optionalDependencies: [],
    },
  },
  {
    id: 'assets-hub',
    name: 'Assets Hub',
    description: 'S3-compatible asset upload and public read service',
    group: 'backend',
    monogram: 'AH',
    technologies: ['hono', 'nodejs', 'typescript', 'graphql'],
    cwd: REPO_ROOT,
    config: {
      kind: 'env-files',
      root: fromRoot('backend/assets-hub'),
      environment: 'development',
    },
    command: 'yarn',
    args: ['dev:assets-hub'],
    env: {
      ASSETS_HUB_CORS_ORIGIN:
        'http://localhost:3003,http://dashboard.groupher.localhost,https://dashboard.groupher.localhost,http://dash.groupher.localhost,https://dash.groupher.localhost,http://apply.groupher.localhost,https://apply.groupher.localhost,https://groupher.localhost',
      PORT: '8002',
      SERVICE_AUTH_ISSUER: LOCAL_SERVICE_ENDPOINTS.auth,
      SERVICE_AUTH_JWKS_URL: `${LOCAL_SERVICE_ENDPOINTS.auth}/.well-known/jwks.json`,
      SERVICE_AUTH_TOKEN_ENDPOINT: `${LOCAL_SERVICE_ENDPOINTS.auth}/oauth2/token`,
    },
    port: 8002,
    url: 'http://127.0.0.1:8002/health',
    portlessName: 'assets-hub',
    portlessUrl: 'https://assets-hub.groupher.localhost/health',
    endpoints: [
      {
        id: 'upload-api',
        label: 'Upload API',
        port: 8002,
        url: 'http://127.0.0.1:8002/health',
        portlessName: 'assets-hub',
        portlessUrl: 'https://assets-hub.groupher.localhost/health',
        portlessAppUrl: 'https://assets-hub.groupher.localhost/',
      },
      {
        id: 'read-worker',
        label: 'Read Worker',
        port: 8787,
        url: 'http://127.0.0.1:8787/health',
        appUrl: 'http://127.0.0.1:8787/',
        portlessName: 'assets',
        portlessUrl: 'https://assets.groupher.localhost/health',
        portlessAppUrl: 'https://assets.groupher.localhost/',
      },
    ],
    metrics: BACKEND_METRICS,
  },
  {
    id: 'document-converter',
    name: 'Document-converter',
    description: 'Documents to Markdown service',
    group: 'backend',
    monogram: 'CV',
    technologies: ['python', 'fastapi', 'markitdown', 'uvicorn'],
    cwd: REPO_ROOT,
    config: {
      kind: 'python-settings',
      root: fromRoot('backend/document-converter'),
      files: ['settings.py'],
      environmentKeys: [
        'DOCUMENT_CONVERTER_MAX_BYTES',
        'DOCUMENT_CONVERTER_MAX_ARCHIVE_BYTES',
        'DOCUMENT_CONVERTER_MAX_ARCHIVE_ENTRIES',
        'DOCUMENT_CONVERTER_SPOOL_BYTES',
        'DOCUMENT_CONVERTER_ALLOWED_ORIGINS',
      ],
    },
    command: existsSync(converterPythonExecutable) ? 'make' : undefined,
    args: ['be.document-converter.start'],
    port: 8000,
    url: 'http://127.0.0.1:8000/health',
    portlessName: 'converter',
    portlessUrl: 'https://converter.groupher.localhost/health',
    unavailableReason: existsSync(converterPythonExecutable)
      ? undefined
      : 'Python 3.12 environment is not installed at backend/document-converter/.venv.',
    metrics: {
      ...BACKEND_METRICS,
      serverRssBytes: 1_024 * MB,
    },
  },
  {
    id: 'gatus',
    name: 'Groupher Status',
    description: 'Local service availability dashboard',
    group: 'infra',
    monogram: 'ST',
    cwd: REPO_ROOT,
    command: 'bash',
    args: ['ops/status/start-local.sh'],
    port: 8080,
    url: 'http://127.0.0.1:8080/health',
    appUrl: 'http://127.0.0.1:8080/',
    portlessName: 'gatus',
    portlessUrl: 'https://gatus.groupher.localhost/health',
    portlessAppUrl: 'https://gatus.groupher.localhost/',
    readiness: 'http-status',
    metrics: BACKEND_METRICS,
  },
]

export const SERVICE_RELATIONS: TServiceRelation[] = [
  {
    id: 'gateway-auth',
    source: 'gateway',
    target: 'auth',
    kind: 'route',
    label: '/api/auth/*',
  },
  {
    id: 'gateway-landing',
    source: 'gateway',
    target: 'landing',
    kind: 'route',
    label: '/, /pricing, /book-demo',
  },
  {
    id: 'auth-main',
    source: 'auth',
    target: 'main',
    kind: 'auth',
    label: 'signed-in session',
  },
  {
    id: 'auth-dashboard',
    source: 'auth',
    target: 'dashboard',
    kind: 'auth',
    label: '/:community/dashboard/*',
  },
  {
    id: 'gateway-dash',
    source: 'gateway',
    target: 'dash',
    kind: 'route',
    label: '/:community/dash/*',
  },
  {
    id: 'gateway-main',
    source: 'gateway',
    target: 'main',
    kind: 'route',
    label: 'all other routes',
  },
  {
    id: 'gateway-apply',
    source: 'gateway',
    target: 'apply',
    kind: 'route',
    label: '/apply/*',
  },
  {
    id: 'gateway-press',
    source: 'gateway',
    target: 'press',
    kind: 'route',
    label: '*.md, feed.*, llms.txt, sitemap.xml',
  },
  {
    id: 'press-phoenix',
    source: 'press',
    target: 'phoenix',
    kind: 'api',
    label: 'CMS.Press GraphQL projection',
  },
  {
    id: 'main-phoenix',
    source: 'main',
    target: 'phoenix',
    kind: 'api',
    label: 'GraphQL',
  },
  {
    id: 'community-phoenix',
    source: 'community',
    target: 'phoenix',
    kind: 'api',
    label: 'GraphQL',
  },
  {
    id: 'dashboard-phoenix',
    source: 'dashboard',
    target: 'phoenix',
    kind: 'api',
    label: 'GraphQL',
  },
  {
    id: 'dashboard-content-import',
    source: 'dashboard',
    target: 'content-import',
    kind: 'api',
    label: '/api/docs/import/*',
  },
  {
    id: 'dashboard-assets-hub',
    source: 'dashboard',
    target: 'assets-hub',
    kind: 'api',
    label: 'asset upload flow',
  },
  {
    id: 'dash-phoenix',
    source: 'dash',
    target: 'phoenix',
    kind: 'api',
    label: 'GraphQL',
  },
  {
    id: 'apply-phoenix',
    source: 'apply',
    target: 'phoenix',
    kind: 'api',
    label: 'CommunityApplications GraphQL',
  },
  {
    id: 'apply-assets-hub',
    source: 'apply',
    target: 'assets-hub',
    kind: 'api',
    label: 'Application Logo upload',
  },
  {
    id: 'dash-content-import',
    source: 'dash',
    target: 'content-import',
    kind: 'api',
    label: '/api/docs/import/*',
  },
  {
    id: 'dash-assets-hub',
    source: 'dash',
    target: 'assets-hub',
    kind: 'api',
    label: 'asset upload flow',
  },
  {
    id: 'assets-hub-phoenix',
    source: 'assets-hub',
    target: 'phoenix',
    kind: 'api',
    label: 'trusted GraphQL',
  },
  {
    id: 'phoenix-assets-hub',
    source: 'phoenix',
    target: 'assets-hub',
    kind: 'api',
    label: 'asset callbacks',
  },
  {
    id: 'content-import-phoenix',
    source: 'content-import',
    target: 'phoenix',
    kind: 'api',
    label: 'trusted GraphQL',
  },
  {
    id: 'content-import-document-converter',
    source: 'content-import',
    target: 'document-converter',
    kind: 'api',
    label: 'file conversion',
  },
  {
    id: 'dashboard-document-converter',
    source: 'dashboard',
    target: 'document-converter',
    kind: 'api',
    label: '/api/artiment/import -> /convert',
  },
  {
    id: 'dash-document-converter',
    source: 'dash',
    target: 'document-converter',
    kind: 'api',
    label: '/api/artiment/import -> /convert',
  },
]
