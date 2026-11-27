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
import {
  LOCAL_SERVICE_AUTH_ISSUER,
  LOCAL_SERVICE_ENDPOINTS,
  LOCAL_SERVICE_GRAPHQL_ENDPOINTS,
} from './service-endpoints.ts'

export type TServiceConfigDefinition =
  | {
      kind: 'env-files'
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

export type TServiceStartupCheck = {
  healthCheckName: string
  id: string
  label: string
  url: string
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
  localEnvironment?: {
    env?: Record<string, string>
    secrets?: Record<string, string>
    editableEnvKeys?: readonly string[]
    externalEnvKeys?: readonly string[]
    authResources?: Record<string, string>
    serviceAuth?: {
      allowedAudiences: string[]
      allowedScopes: string[]
      clientId: string
      clientRef: string
      serviceName: string
    }
  }
  workerEnvFile?: boolean
  workerStateDir?: boolean
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
  startupChecks?: readonly TServiceStartupCheck[]
}

export const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url))
const fromRoot = (...parts: string[]): string => path.join(REPO_ROOT, ...parts)
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

const DASH_CHAIN_POLICY = {
  defaultMode: 'chain',
  requiredDependencies: ['dev-gateway', 'auth', 'phoenix', 'assets-hub'],
  optionalDependencies: ['import', 'converter'],
} satisfies TServiceStartPolicy

const APPLY_CHAIN_POLICY = {
  defaultMode: 'chain',
  requiredDependencies: ['dev-gateway', 'auth', 'phoenix', 'assets-hub'],
  optionalDependencies: [],
} satisfies TServiceStartPolicy

const LANDING_CHAIN_POLICY = {
  defaultMode: 'chain',
  requiredDependencies: ['dev-gateway'],
  optionalDependencies: [],
} satisfies TServiceStartPolicy

const COMMUNITY_CHAIN_POLICY = {
  defaultMode: 'chain',
  requiredDependencies: ['auth', 'phoenix', 'assets-hub'],
  optionalDependencies: [],
} satisfies TServiceStartPolicy

const SERVICE_AUTH_STARTUP_CHECKS = [
  {
    healthCheckName: 'phoenix-service-auth',
    id: 'service-auth-contract',
    label: 'Auth to Phoenix Service Identity contract',
    url: `${LOCAL_SERVICE_ENDPOINTS.auth}/health/service-auth`,
  },
] as const satisfies readonly TServiceStartupCheck[]

export const SERVICE_DEFINITIONS: TServiceDefinition[] = [
  {
    id: 'dev-gateway',
    name: 'Dev Gateway',
    description: 'Local-only routing entry',
    group: 'backend',
    monogram: 'GW',
    technologies: ['hono', 'nodejs', 'typescript', 'routing'],
    cwd: REPO_ROOT,
    config: {
      kind: 'env-files',
      root: fromRoot('infra/dev-gateway'),
      environment: 'development',
    },
    command: 'make',
    args: ['be.dev-gateway.start.managed'],
    localEnvironment: {
      env: {
        PORT: '3003',
        NEXT_PUBLIC_SITE_URL: 'https://groupher.localhost',
        LANDING_SITE: LOCAL_SERVICE_ENDPOINTS.landing,
        DASH_SITE: LOCAL_SERVICE_ENDPOINTS.dash,
        APPLY_SITE: LOCAL_SERVICE_ENDPOINTS.apply,
        COMMUNITY_SITE: LOCAL_SERVICE_ENDPOINTS.community,
        AUTH_SITE: LOCAL_SERVICE_ENDPOINTS.auth,
        API_SITE: LOCAL_SERVICE_ENDPOINTS.phoenix,
        PRESS_SITE: LOCAL_SERVICE_ENDPOINTS.press,
      },
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
    args: ['be.auth.start.managed'],
    localEnvironment: {
      externalEnvKeys: [
        'AUTH_GITHUB_ID',
        'AUTH_GITHUB_SECRET',
        'AUTH_LINUXDO_ID',
        'AUTH_LINUXDO_SECRET',
      ],
      env: {
        PORT: '3004',
        AUTH_URL: 'https://auth.groupher.localhost',
        PHOENIX_GRAPHQL_ENDPOINT: LOCAL_SERVICE_GRAPHQL_ENDPOINTS.phoenix,
        AUTH_COOKIE_DOMAIN: '.groupher.localhost',
        DEV_HUB_SERVICE_AUTH_PROBE: 'true',
        SERVICE_AUTH_ISSUER: LOCAL_SERVICE_AUTH_ISSUER,
        SERVICE_AUTH_JWKS_URL: `${LOCAL_SERVICE_ENDPOINTS.auth}/.well-known/jwks.json`,
        SERVICE_AUTH_TOKEN_ENDPOINT: `${LOCAL_SERVICE_ENDPOINTS.auth}/oauth2/token`,
      },
      authResources: {
        'https://api.groupher.com/auth': 'phoenix:auth-api',
        'https://api.groupher.com/assets': 'phoenix:assets-api',
        'https://api.groupher.com/import': 'phoenix:import-api',
        'https://assets.groupher.com/internal': 'assets-hub:internal-api',
        'https://api.groupher.com/content-publisher': 'phoenix:content-publisher-api',
        'https://api.groupher.com/press': 'phoenix:press-api',
        'https://import.groupher.com/internal': 'import:internal-api',
      },
      serviceAuth: {
        allowedAudiences: ['phoenix:auth-api'],
        allowedScopes: [
          'auth:session:signin',
          'auth:session:refresh',
          'auth:session:read',
          'auth:session:revoke',
          'auth:oauth:read',
          'auth:oauth:register',
          'auth:oauth:flow',
          'auth:oauth:unlink',
        ],
        clientId: 'auth-development',
        clientRef: 'client_local_auth',
        serviceName: 'auth',
      },
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
    args: ['fe.dev.landing.managed'],
    localEnvironment: {
      env: {
        PORT: '3002',
        NEXT_PUBLIC_SITE_URL: 'http://localhost:3002',
      },
    },
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
    command: 'make',
    args: ['fe.dev.community.managed'],
    localEnvironment: {
      env: {
        PORT: '3007',
        GRAPHQL_ENDPOINT: LOCAL_SERVICE_GRAPHQL_ENDPOINTS.phoenix,
        NEXT_PUBLIC_AUTH_ENDPOINT: `${LOCAL_SERVICE_AUTH_ISSUER}/api/auth`,
        SERVICE_AUTH_TOKEN_ENDPOINT: `${LOCAL_SERVICE_ENDPOINTS.auth}/oauth2/token`,
      },
      serviceAuth: {
        allowedAudiences: ['phoenix:content-publisher-api'],
        allowedScopes: [
          'content:article:write',
          'content:comment:write',
          'content:history:browser',
        ],
        clientId: 'community-development',
        clientRef: 'dev-hub-local-community',
        serviceName: 'community',
      },
    },
    port: 3007,
    url: 'http://127.0.0.1:3007/health',
    appUrl: 'http://127.0.0.1:3007/home/post',
    portlessName: 'community',
    portlessUrl: 'https://community.groupher.localhost/health',
    portlessAppUrl: 'https://community.groupher.localhost/home/post',
    metrics: FRONTEND_METRICS,
    startPolicy: COMMUNITY_CHAIN_POLICY,
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
    args: ['fe.dev.dash.managed'],
    localEnvironment: {
      editableEnvKeys: ['DASH_DEFAULT_COMMUNITY'],
      env: {
        PORT: '3005',
        NEXT_PUBLIC_SITE_URL: 'https://dash.groupher.localhost',
        NEXT_PUBLIC_AUTH_ENDPOINT: `${LOCAL_SERVICE_AUTH_ISSUER}/api/auth`,
        GRAPHQL_ENDPOINT: LOCAL_SERVICE_GRAPHQL_ENDPOINTS.phoenix,
        NEXT_PUBLIC_ASSETS_HUB_ENDPOINT: 'https://assets-hub.groupher.localhost',
        NEXT_PUBLIC_ASSETS_HUB_READ_ENDPOINT: 'https://assets.groupher.localhost',
        IMPORT_APP_ENDPOINT: LOCAL_SERVICE_ENDPOINTS.import,
        SERVICE_AUTH_ISSUER: LOCAL_SERVICE_AUTH_ISSUER,
        SERVICE_AUTH_JWKS_URL: `${LOCAL_SERVICE_ENDPOINTS.auth}/.well-known/jwks.json`,
        SERVICE_AUTH_TOKEN_ENDPOINT: `${LOCAL_SERVICE_ENDPOINTS.auth}/oauth2/token`,
      },
      serviceAuth: {
        allowedAudiences: ['phoenix:content-publisher-api', 'import:internal-api'],
        allowedScopes: [
          'content:article:write',
          'content:comment:write',
          'content:history:browser',
          'docs:import:proxy',
        ],
        clientId: 'dash-development',
        clientRef: 'dev-hub-local-dash',
        serviceName: 'dash',
      },
    },
    port: 3005,
    url: 'http://127.0.0.1:3005/health',
    appUrl: 'http://127.0.0.1:3005/home/overview',
    portlessName: 'dash',
    portlessUrl: 'https://dash.groupher.localhost/health',
    portlessAppUrl: 'https://dash.groupher.localhost/home/overview',
    metrics: FRONTEND_METRICS,
    startPolicy: DASH_CHAIN_POLICY,
    startupChecks: SERVICE_AUTH_STARTUP_CHECKS,
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
    args: ['fe.dev.apply.managed'],
    localEnvironment: {
      env: {
        PORT: '3006',
        GRAPHQL_ENDPOINT: LOCAL_SERVICE_GRAPHQL_ENDPOINTS.phoenix,
        NEXT_PUBLIC_SITE_URL: 'https://groupher.localhost',
        ASSETS_HUB_ENDPOINT: 'https://assets-hub.groupher.localhost',
      },
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
    startupChecks: SERVICE_AUTH_STARTUP_CHECKS,
  },
  {
    id: 'inspire-me',
    name: 'Inspire Me',
    description: 'Local feedback research library',
    group: 'frontend',
    monogram: 'IN',
    technologies: ['tanstack-start', 'react', 'typescript', 'tailwindcss'],
    cwd: REPO_ROOT,
    config: {
      kind: 'env-files',
      root: fromRoot('frontend/inspire-me'),
      environment: 'development',
    },
    command: 'make',
    args: ['fe.dev.inspire.managed'],
    localEnvironment: {},
    port: 3010,
    url: 'http://127.0.0.1:3010/health',
    appUrl: 'http://127.0.0.1:3010/',
    portlessName: 'inspire-me',
    portlessUrl: 'https://inspire-me.groupher.localhost/health',
    portlessAppUrl: 'https://inspire-me.groupher.localhost/',
    metrics: FRONTEND_METRICS,
  },
  {
    id: 'widget-sandbox',
    name: 'Widget Sandbox',
    description: 'Local preview for the Widget library',
    group: 'frontend',
    monogram: 'WG',
    technologies: ['lit', 'typescript', 'routing', 'nodejs'],
    cwd: REPO_ROOT,
    config: {
      kind: 'env-files',
      root: fromRoot('frontend/widget'),
      environment: 'development',
    },
    command: 'make',
    args: ['fe.dev.widget.managed'],
    localEnvironment: { env: { PORT: '3011' } },
    port: 3011,
    url: 'http://127.0.0.1:3011/',
    appUrl: 'http://127.0.0.1:3011/',
    portlessName: 'widget',
    portlessUrl: 'https://widget.groupher.localhost/',
    portlessAppUrl: 'https://widget.groupher.localhost/',
    metrics: FRONTEND_METRICS,
  },
  {
    id: 'phoenix',
    name: 'Phoenix',
    description: 'GraphQL API in local development mode',
    group: 'backend',
    monogram: 'PX',
    technologies: ['phoenix', 'elixir', 'absinthe', 'postgresql'],
    cwd: REPO_ROOT,
    config: {
      kind: 'elixir-config',
      root: fromRoot('backend/api/config'),
      environment: 'dev',
    },
    command: 'make',
    args: ['be.start.managed'],
    localEnvironment: {
      editableEnvKeys: [
        'DB_NAME',
        'DB_HOST',
        'DB_PORT',
        'DB_USERNAME',
        'DB_PASSWORD',
        'DB_POOL_SIZE',
        'OAUTH_GITHUB_STATE',
        'OAUTH_LINUXDO_STATE',
        'MIX_DEPS_PATH',
        'MIX_BUILD_PATH',
      ],
      externalEnvKeys: [
        'OAUTH_GITHUB_CLIENT_ID',
        'OAUTH_GITHUB_CLIENT_SECRET',
        'ALGOLIA_APPLICATION_ID',
        'ALGOLIA_SEARCH_API_KEY',
        'ALGOLIA_ADMIN_API_KEY',
        'ALGOLIA_INDEX_NAME',
      ],
      env: {
        DB_NAME: 'groupher_server_dev',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USERNAME: 'postgres',
        DB_PASSWORD: 'postgres',
        DB_POOL_SIZE: '10',
        ASSETS_HUB_BATCH_ENDPOINT: LOCAL_SERVICE_ENDPOINTS.assetsHubRead,
        ASSETS_HUB_DELETE_ENDPOINT: LOCAL_SERVICE_ENDPOINTS.assetsHubRead,
        ASSETS_PUBLIC_ENDPOINT: 'https://assets.groupher.localhost',
        SERVICE_AUTH_ISSUER: LOCAL_SERVICE_AUTH_ISSUER,
        SERVICE_AUTH_JWKS_URL: `${LOCAL_SERVICE_ENDPOINTS.auth}/.well-known/jwks.json`,
        SERVICE_AUTH_TOKEN_ENDPOINT: `${LOCAL_SERVICE_ENDPOINTS.auth}/oauth2/token`,
      },
      secrets: {
        PHX_JWT_SECRET: 'phoenix:jwt-secret',
        ASSETS_HUB_CAPABILITY_SECRET: 'assets-hub:capability-secret',
      },
      serviceAuth: {
        allowedAudiences: ['assets-hub:internal-api'],
        allowedScopes: [
          'assets:generated-batch:claim',
          'assets:generated-batch:cleanup',
          'assets:object:delete',
        ],
        clientId: 'phoenix-development',
        clientRef: 'client_local_phoenix',
        serviceName: 'phoenix',
      },
    },
    port: 4001,
    url: 'http://127.0.0.1:4001/health',
    portlessName: 'api',
    portlessUrl: 'https://api.groupher.localhost/health',
    metrics: BACKEND_METRICS,
  },
  {
    id: 'import',
    name: 'Import',
    description: 'External source import orchestration',
    group: 'backend',
    monogram: 'CI',
    technologies: ['hono', 'cloudflare', 'typescript', 'graphql'],
    cwd: REPO_ROOT,
    config: {
      kind: 'env-files',
      root: fromRoot('backend/import'),
      environment: 'development',
    },
    command: 'make',
    args: ['be.import.start.managed'],
    workerEnvFile: true,
    localEnvironment: {
      env: {
        DOCUMENT_CONVERTER_APP_ENDPOINT: LOCAL_SERVICE_ENDPOINTS.converter,
        PHOENIX_GRAPHQL_ENDPOINT: LOCAL_SERVICE_GRAPHQL_ENDPOINTS.phoenix,
        PORT: '8001',
        SERVICE_AUTH_ISSUER: LOCAL_SERVICE_AUTH_ISSUER,
        SERVICE_AUTH_JWKS_URL: `${LOCAL_SERVICE_ENDPOINTS.auth}/.well-known/jwks.json`,
        SERVICE_AUTH_TOKEN_ENDPOINT: `${LOCAL_SERVICE_ENDPOINTS.auth}/oauth2/token`,
        IMPORT_SERVICE_AUTH_AUDIENCE: 'import:internal-api',
        SERVICE_AUTH_PHOENIX_RESOURCE: 'https://api.groupher.com/import',
      },
      secrets: { IMPORT_PREVIEW_SECRET: 'import:preview-secret' },
      serviceAuth: {
        allowedAudiences: ['phoenix:import-api'],
        allowedScopes: ['import:write'],
        clientId: 'import-development',
        clientRef: 'client_local_import',
        serviceName: 'import',
      },
    },
    port: 8001,
    url: 'http://127.0.0.1:8001/health',
    portlessName: 'import',
    portlessUrl: 'https://import.groupher.localhost/health',
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
    args: ['be.press.start.managed'],
    localEnvironment: {
      editableEnvKeys: ['DB_NAME', 'DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD'],
      env: {
        DB_HOST: 'localhost',
        DB_NAME: 'groupher_server_dev',
        DB_PASSWORD: 'postgres',
        DB_PORT: '5432',
        DB_USERNAME: 'postgres',
        PHOENIX_GRAPHQL_ENDPOINT: LOCAL_SERVICE_GRAPHQL_ENDPOINTS.phoenix,
        PORT: '8003',
        SERVICE_AUTH_ISSUER: LOCAL_SERVICE_AUTH_ISSUER,
        SERVICE_AUTH_JWKS_URL: `${LOCAL_SERVICE_ENDPOINTS.auth}/.well-known/jwks.json`,
        SERVICE_AUTH_TOKEN_ENDPOINT: `${LOCAL_SERVICE_ENDPOINTS.auth}/oauth2/token`,
        PHOENIX_PRESS_RESOURCE: 'https://api.groupher.com/press',
      },
      secrets: { METRIC_IP_SALT: 'press:metric-ip-salt' },
      serviceAuth: {
        allowedAudiences: ['phoenix:press-api'],
        allowedScopes: ['press:article:read', 'press:rss-feed:read', 'press:site:read'],
        clientId: 'press-development',
        clientRef: 'client_local_press',
        serviceName: 'press',
      },
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
    command: 'make',
    args: ['be.assets-hub.start.managed'],
    localEnvironment: {
      env: {
        ASSETS_HUB_RUNTIME: 'local',
        ASSETS_HUB_BATCH_ENDPOINT: LOCAL_SERVICE_ENDPOINTS.assetsHubRead,
        ASSETS_HUB_DELETE_ENDPOINT: LOCAL_SERVICE_ENDPOINTS.assetsHub,
        ASSETS_HUB_LOCAL_STORAGE_DIR: fromRoot('.local/assets-hub'),
        ASSETS_HUB_CORS_ORIGIN:
          'http://localhost:3003,http://dash.groupher.localhost,https://dash.groupher.localhost,http://apply.groupher.localhost,https://apply.groupher.localhost,https://groupher.localhost',
        ASSETS_PUBLIC_ENDPOINT: 'https://assets.groupher.localhost',
        PHOENIX_GRAPHQL_ENDPOINT: LOCAL_SERVICE_GRAPHQL_ENDPOINTS.phoenix,
        PORT: '8002',
        SERVICE_AUTH_ISSUER: LOCAL_SERVICE_AUTH_ISSUER,
        SERVICE_AUTH_JWKS_URL: `${LOCAL_SERVICE_ENDPOINTS.auth}/.well-known/jwks.json`,
        SERVICE_AUTH_TOKEN_ENDPOINT: `${LOCAL_SERVICE_ENDPOINTS.auth}/oauth2/token`,
      },
      secrets: { ASSETS_HUB_CAPABILITY_SECRET: 'assets-hub:capability-secret' },
      externalEnvKeys: [
        'ASSETS_R2_BUCKET',
        'ASSETS_R2_REGION',
        'ASSETS_R2_ENDPOINT',
        'ASSETS_R2_ACCESS_KEY_ID',
        'ASSETS_R2_SECRET_ACCESS_KEY',
      ],
      serviceAuth: {
        allowedAudiences: ['phoenix:assets-api', 'assets-hub:internal-api'],
        allowedScopes: [
          'assets:upload:complete',
          'assets:origin:read',
          'assets:generated-batch:register',
        ],
        clientId: 'assets-hub-development',
        clientRef: 'client_local_assets_hub',
        serviceName: 'assets-hub',
      },
    },
    port: 8002,
    url: 'http://127.0.0.1:8002/health',
    portlessName: 'assets-hub',
    portlessUrl: 'https://assets-hub.groupher.localhost/health',
    endpoints: [
      {
        id: 'local-provider',
        label: 'Local Provider',
        port: 8002,
        url: 'http://127.0.0.1:8002/health/ready',
        appUrl: 'http://127.0.0.1:8002/',
        portlessName: 'assets',
        portlessUrl: 'https://assets.groupher.localhost/health',
        portlessAppUrl: 'https://assets.groupher.localhost/',
      },
    ],
    metrics: BACKEND_METRICS,
    startPolicy: {
      defaultMode: 'chain',
      requiredDependencies: ['auth', 'phoenix'],
      optionalDependencies: [],
    },
  },
  {
    id: 'converter',
    name: 'Converter',
    description: 'Documents to Markdown service',
    group: 'backend',
    monogram: 'CV',
    technologies: ['cloudflare', 'wasm', 'typescript', 'hono'],
    cwd: REPO_ROOT,
    command: 'make',
    args: ['be.converter.start.managed'],
    localEnvironment: {},
    port: 8000,
    url: 'http://127.0.0.1:8000/health',
    portlessName: 'converter',
    portlessUrl: 'https://converter.groupher.localhost/health',
    metrics: {
      ...BACKEND_METRICS,
      serverRssBytes: 1_024 * MB,
    },
  },
  {
    id: 'assets-read-worker',
    name: 'Assets Read Worker',
    description: 'Cloudflare Worker for asset reads and generated batches',
    group: 'backend',
    monogram: 'AR',
    technologies: ['cloudflare', 'typescript', 'graphql', 'routing'],
    cwd: REPO_ROOT,
    command: 'make',
    args: ['be.assets-read-worker.start.managed'],
    workerStateDir: true,
    localEnvironment: {
      env: {
        ASSETS_PUBLIC_ENDPOINT: 'https://assets-worker.groupher.localhost',
        ASSETS_HUB_BATCH_ENDPOINT: LOCAL_SERVICE_ENDPOINTS.assetsHub,
        ENVIRONMENT: 'development',
        PHOENIX_GRAPHQL_ENDPOINT: LOCAL_SERVICE_GRAPHQL_ENDPOINTS.phoenix,
        SERVICE_AUTH_ISSUER: LOCAL_SERVICE_AUTH_ISSUER,
        SERVICE_AUTH_JWKS_URL: `${LOCAL_SERVICE_ENDPOINTS.auth}/.well-known/jwks.json`,
        SERVICE_AUTH_TOKEN_ENDPOINT: `${LOCAL_SERVICE_ENDPOINTS.auth}/oauth2/token`,
      },
      secrets: { ASSETS_HUB_CAPABILITY_SECRET: 'assets-hub:capability-secret' },
      serviceAuth: {
        allowedAudiences: ['phoenix:assets-api'],
        allowedScopes: ['assets:origin:read', 'assets:generated-batch:register'],
        clientId: 'assets-read-worker-development',
        clientRef: 'client_local_assets_read_worker',
        serviceName: 'assets-read-worker',
      },
    },
    port: 8787,
    url: 'http://127.0.0.1:8787/health/ready',
    appUrl: 'http://127.0.0.1:8787/',
    portlessName: 'assets-worker',
    portlessUrl: 'https://assets-worker.groupher.localhost/health/ready',
    portlessAppUrl: 'https://assets-worker.groupher.localhost/',
    readiness: 'http-status',
    metrics: BACKEND_METRICS,
    startPolicy: {
      defaultMode: 'chain',
      requiredDependencies: ['auth', 'phoenix'],
      optionalDependencies: [],
    },
    startupChecks: SERVICE_AUTH_STARTUP_CHECKS,
  },
  {
    id: 'edge-router',
    name: 'Edge Router Local',
    description: 'Local Cloudflare runtime for production route contract checks',
    group: 'infra',
    monogram: 'ER',
    technologies: ['cloudflare', 'typescript', 'routing', 'nodejs'],
    cwd: REPO_ROOT,
    command: 'make',
    args: ['be.edge-router.start.managed'],
    workerStateDir: true,
    localEnvironment: { env: { API_SITE: LOCAL_SERVICE_GRAPHQL_ENDPOINTS.phoenix } },
    port: 8788,
    url: 'http://127.0.0.1:8788/health',
    appUrl: 'http://127.0.0.1:8788/',
    portlessName: 'edge-router',
    portlessUrl: 'https://edge-router.groupher.localhost/health',
    portlessAppUrl: 'https://edge-router.groupher.localhost/',
    metrics: BACKEND_METRICS,
  },
  {
    id: 'core-vgpu-poc',
    name: 'Core VGPU POC',
    description: 'Isolated Core VGPU shader preview',
    group: 'frontend',
    monogram: 'VG',
    technologies: ['react', 'typescript', 'wasm', 'routing'],
    cwd: REPO_ROOT,
    command: 'make',
    args: ['fe.dev.vgpu-poc.managed'],
    localEnvironment: { env: { PORT: '3012' } },
    port: 3012,
    url: 'http://127.0.0.1:3012/',
    appUrl: 'http://127.0.0.1:3012/',
    portlessName: 'vgpu',
    portlessUrl: 'https://vgpu.groupher.localhost/',
    portlessAppUrl: 'https://vgpu.groupher.localhost/',
    metrics: FRONTEND_METRICS,
  },
  {
    id: 'status',
    name: 'Status Worker',
    description: 'Local Status dashboard and health endpoints',
    group: 'backend',
    monogram: 'ST',
    technologies: ['cloudflare', 'typescript', 'routing', 'nodejs'],
    cwd: REPO_ROOT,
    command: 'make',
    args: ['be.status.start.managed'],
    workerEnvFile: true,
    localEnvironment: { env: { ENVIRONMENT: 'development' } },
    port: 8793,
    url: 'http://127.0.0.1:8793/health',
    appUrl: 'http://127.0.0.1:8793/',
    portlessName: 'status',
    portlessUrl: 'https://status.groupher.localhost/health',
    portlessAppUrl: 'https://status.groupher.localhost/',
    readiness: 'health-v1',
    metrics: BACKEND_METRICS,
  },
  {
    id: 'review-ai-worker',
    name: 'Review AI Worker',
    description: 'Local review AI Worker using the configured remote AI binding',
    group: 'backend',
    monogram: 'RA',
    technologies: ['cloudflare', 'typescript', 'routing', 'nodejs'],
    cwd: REPO_ROOT,
    command: 'make',
    args: ['be.review-ai-worker.start.managed'],
    workerEnvFile: true,
    localEnvironment: { secrets: { REVIEW_BOT_TOKEN: 'review-ai-worker:token' } },
    port: 8794,
    url: 'http://127.0.0.1:8794/',
    appUrl: 'http://127.0.0.1:8794/',
    portlessName: 'review-ai',
    portlessUrl: 'https://review-ai.groupher.localhost/',
    portlessAppUrl: 'https://review-ai.groupher.localhost/',
    metrics: BACKEND_METRICS,
  },
  {
    id: 'mock-server',
    name: 'Mock GraphQL Server',
    description: 'Interactive local GraphQL mock and console',
    group: 'backend',
    monogram: 'MS',
    technologies: ['nodejs', 'graphql', 'typescript', 'routing'],
    cwd: REPO_ROOT,
    command: 'make',
    args: ['be.mock-server.start.managed'],
    localEnvironment: { env: { PORT: '4010', MOCK_GRAPHQL_PORT: '4010' } },
    port: 4010,
    url: 'http://127.0.0.1:4010/health',
    appUrl: 'http://127.0.0.1:4010/graphiql',
    portlessName: 'mock',
    portlessUrl: 'https://mock.groupher.localhost/health',
    portlessAppUrl: 'https://mock.groupher.localhost/graphiql',
    metrics: BACKEND_METRICS,
  },
]

export const SERVICE_RELATIONS: TServiceRelation[] = [
  {
    id: 'gateway-auth',
    source: 'dev-gateway',
    target: 'auth',
    kind: 'route',
    label: '/api/auth/*',
  },
  {
    id: 'gateway-landing',
    source: 'dev-gateway',
    target: 'landing',
    kind: 'route',
    label: '/, /pricing, /book-demo',
  },
  {
    id: 'gateway-dash',
    source: 'dev-gateway',
    target: 'dash',
    kind: 'route',
    label: '/:community/dash/*',
  },
  {
    id: 'gateway-apply',
    source: 'dev-gateway',
    target: 'apply',
    kind: 'route',
    label: '/apply/*',
  },
  {
    id: 'gateway-press',
    source: 'dev-gateway',
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
    id: 'community-phoenix',
    source: 'community',
    target: 'phoenix',
    kind: 'api',
    label: 'GraphQL',
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
    id: 'dash-import',
    source: 'dash',
    target: 'import',
    kind: 'api',
    label: '/api/docs/import/*, /api/artiment/import',
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
    id: 'import-phoenix',
    source: 'import',
    target: 'phoenix',
    kind: 'api',
    label: 'trusted GraphQL',
  },
  {
    id: 'import-converter',
    source: 'import',
    target: 'converter',
    kind: 'api',
    label: 'file conversion',
  },
]
