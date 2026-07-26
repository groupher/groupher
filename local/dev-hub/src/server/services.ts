import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type {
  TMetricThresholds,
  TServiceGroup,
  TServiceRelation,
  TTechnologyStack,
} from '../shared/contracts.ts'

export type TServiceConfigDefinition =
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
  portlessName?: string
  portlessUrl?: string
  unavailableReason?: string
  metrics: TMetricThresholds
}

export const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url))
const fromRoot = (...parts: string[]): string => path.join(REPO_ROOT, ...parts)
const converterExecutable = fromRoot('services/document-converter/.venv/bin/uvicorn')
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

export const SERVICE_DEFINITIONS: TServiceDefinition[] = [
  {
    id: 'gateway',
    name: 'Gateway',
    description: 'Routing and edge application',
    group: 'frontend',
    monogram: 'GW',
    technologies: ['nextjs', 'react', 'typescript', 'nodejs'],
    cwd: REPO_ROOT,
    config: {
      kind: 'next-env',
      root: fromRoot('frontend/gateway'),
      environment: 'development',
    },
    command: 'yarn',
    args: ['run', 'dev:gateway'],
    env: {
      PORT: '3003',
      NEXT_PUBLIC_SITE_URL: 'https://groupher.localhost',
      LANDING_SITE: 'http://127.0.0.1:3002',
      MAIN_SITE: 'http://127.0.0.1:3000',
      DASHBOARD_SITE: 'http://127.0.0.1:3001',
      AUTH_SITE: 'http://127.0.0.1:3004',
      API_SITE: 'http://127.0.0.1:4001',
    },
    port: 3003,
    url: 'http://127.0.0.1:3003',
    portlessName: 'groupher',
    portlessUrl: 'https://groupher.localhost',
    metrics: FRONTEND_METRICS,
  },
  {
    id: 'auth',
    name: 'Auth',
    description: 'OAuth and browser session boundary',
    group: 'frontend',
    monogram: 'AU',
    technologies: ['nextjs', 'authjs', 'typescript', 'oauth'],
    cwd: REPO_ROOT,
    config: {
      kind: 'next-env',
      root: fromRoot('frontend/auth'),
      environment: 'development',
    },
    command: 'make',
    args: ['fe.dev.auth'],
    env: {
      PORT: '3004',
      AUTH_URL: 'https://groupher.localhost',
      PHOENIX_GRAPHQL_ENDPOINT: 'http://127.0.0.1:4001/graphiql',
      AUTH_COOKIE_DOMAIN: '.groupher.localhost',
    },
    port: 3004,
    url: 'http://127.0.0.1:3004/health',
    portlessName: 'auth',
    portlessUrl: 'https://auth.groupher.localhost/health',
    metrics: FRONTEND_METRICS,
  },
  {
    id: 'landing',
    name: 'Landing',
    description: 'Public marketing site',
    group: 'frontend',
    monogram: 'LD',
    technologies: ['nextjs', 'react', 'typescript', 'tailwindcss'],
    cwd: REPO_ROOT,
    config: {
      kind: 'next-env',
      root: fromRoot('frontend/landing'),
      environment: 'development',
    },
    command: 'make',
    args: ['fe.dev.landing'],
    port: 3002,
    url: 'http://127.0.0.1:3002',
    portlessName: 'landing',
    portlessUrl: 'https://landing.groupher.localhost',
    metrics: FRONTEND_METRICS,
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
    url: 'http://127.0.0.1:3000',
    portlessName: 'main',
    portlessUrl: 'https://main.groupher.localhost',
    metrics: FRONTEND_METRICS,
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
    port: 3001,
    url: 'http://127.0.0.1:3001/home/dashboard',
    portlessName: 'dashboard',
    portlessUrl: 'https://dashboard.groupher.localhost/home/dashboard',
    metrics: FRONTEND_METRICS,
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
      root: fromRoot('local/inspire-me'),
      environment: 'development',
    },
    command: 'yarn',
    args: ['workspace', '@groupher/local-inspire-me', 'dev', '-p', '3010'],
    port: 3010,
    url: 'http://127.0.0.1:3010/canny',
    portlessName: 'inspire-me',
    portlessUrl: 'https://inspire-me.groupher.localhost/canny',
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
      root: fromRoot('backend/main/config'),
      environment: 'mock',
    },
    command: 'make',
    args: ['be.start'],
    port: 4001,
    url: 'http://127.0.0.1:4001/graphiql',
    portlessName: 'api',
    portlessUrl: 'https://api.groupher.localhost/graphiql',
    metrics: BACKEND_METRICS,
  },
  {
    id: 'document-converter',
    name: 'Converter',
    description: 'Documents to Markdown service',
    group: 'backend',
    monogram: 'CV',
    technologies: ['python', 'fastapi', 'markitdown', 'uvicorn'],
    cwd: fromRoot('services/document-converter'),
    config: {
      kind: 'python-settings',
      root: fromRoot('services/document-converter'),
      files: ['settings.py'],
      environmentKeys: [
        'DOCUMENT_CONVERTER_MAX_BYTES',
        'DOCUMENT_CONVERTER_MAX_ARCHIVE_BYTES',
        'DOCUMENT_CONVERTER_MAX_ARCHIVE_ENTRIES',
        'DOCUMENT_CONVERTER_SPOOL_BYTES',
        'DOCUMENT_CONVERTER_ALLOWED_ORIGINS',
      ],
    },
    command: existsSync(converterExecutable) ? converterExecutable : undefined,
    args: ['app:app', '--reload', '--port', '8000'],
    port: 8000,
    url: 'http://127.0.0.1:8000/health',
    portlessName: 'converter',
    portlessUrl: 'https://converter.groupher.localhost/health',
    unavailableReason: existsSync(converterExecutable)
      ? undefined
      : 'Python 3.12 environment is not installed at services/document-converter/.venv.',
    metrics: {
      ...BACKEND_METRICS,
      serverRssBytes: 1_024 * MB,
    },
  },
  {
    id: 'comment-importer',
    name: 'Comment Importer',
    description: 'Future standalone comment import worker',
    group: 'backend',
    monogram: 'CI',
    cwd: REPO_ROOT,
    unavailableReason: 'This capability has not been split into a standalone service yet.',
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
    id: 'gateway-dashboard',
    source: 'gateway',
    target: 'dashboard',
    kind: 'route',
    label: '/:community/dashboard/*',
  },
  {
    id: 'gateway-main',
    source: 'gateway',
    target: 'main',
    kind: 'route',
    label: 'all other routes',
  },
  {
    id: 'main-phoenix',
    source: 'main',
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
]
