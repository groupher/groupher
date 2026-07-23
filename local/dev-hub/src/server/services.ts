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
    url: 'http://localhost:3000',
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
    url: 'http://localhost:3001/home/dashboard',
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
    url: 'http://localhost:3002',
    metrics: FRONTEND_METRICS,
  },
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
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3003',
      LANDING_SITE: 'http://localhost:3002',
      MAIN_SITE: 'http://localhost:3000',
      DASHBOARD_SITE: 'http://localhost:3001',
    },
    port: 3003,
    url: 'http://localhost:3003',
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
    url: 'http://localhost:3010/canny',
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
    url: 'http://localhost:4001/graphiql',
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
    url: 'http://localhost:8000/health',
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
