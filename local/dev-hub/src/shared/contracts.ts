export type TServiceGroup = 'frontend' | 'backend'

export type TTechnology =
  | 'absinthe'
  | 'authjs'
  | 'elixir'
  | 'fastapi'
  | 'graphql'
  | 'hono'
  | 'markitdown'
  | 'nextjs'
  | 'nodejs'
  | 'oauth'
  | 'phoenix'
  | 'postgresql'
  | 'python'
  | 'react'
  | 'routing'
  | 'tailwindcss'
  | 'typescript'
  | 'uvicorn'

export type TTechnologyStack = readonly [TTechnology, TTechnology, TTechnology, TTechnology]

export type TServiceStatus =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'external'
  | 'error'
  | 'unavailable'

export type TServiceStartMode = 'self' | 'chain' | 'related'

export type TServiceStartPolicy = {
  defaultMode: TServiceStartMode
  requiredDependencies: string[]
  optionalDependencies: string[]
}

export type TServiceRelationKind = 'route' | 'api' | 'auth'

export type TServiceRelation = {
  id: string
  source: string
  target: string
  kind: TServiceRelationKind
  label: string
}

export type TLogStream = 'stdout' | 'stderr' | 'system'

export type TServiceLog = {
  seq: number
  runId: string | null
  at: number
  stream: TLogStream
  chunk: string
}

export type TMetricThresholds = {
  serverCpuPercent: number
  serverRssBytes: number
  browserBusyPercent: number
  browserHeapBytes: number
}

export type TPublicService = {
  id: string
  name: string
  description: string
  group: TServiceGroup
  monogram: string
  technologies: TTechnologyStack | null
  port: number | null
  url: string | null
  appUrl: string | null
  portlessName: string | null
  portlessUrl: string | null
  portlessAppUrl: string | null
  status: TServiceStatus
  pid: number | null
  startedAt: number | null
  endedAt: number | null
  exitCode: number | null
  canStart: boolean
  unavailableReason: string | null
  metricThresholds: TMetricThresholds
  startPolicy: TServiceStartPolicy
}

export type TGitDiffScope = 'all' | 'staged' | 'unstaged'

export type TGitSnapshot = {
  branch: string | null
  head: string | null
  upstream: string | null
  ahead: number
  behind: number
  additions: number
  deletions: number
  changedFiles: number
  stagedFiles: number
  unstagedFiles: number
  untrackedFiles: number
  conflictedFiles: number
  stashCount: number
  binaryFiles: number
  revision: number
}

export type TGitDiffPayload = {
  scope: TGitDiffScope
  patch: string
  revision: number
}

export type TServiceConfigKind =
  | 'env-files'
  | 'next-env'
  | 'elixir-config'
  | 'python-settings'
  | 'none'

export type TServiceConfigFileGroup = 'active' | 'other' | 'template'

export type TServiceConfigFile = {
  id: string
  name: string
  path: string
  group: TServiceConfigFileGroup
  active: boolean
  sensitive: boolean
  sizeBytes: number
  modifiedAt: number
}

export type TServiceConfigManifest = {
  serviceId: string
  serviceName: string
  kind: TServiceConfigKind
  environment: string | null
  environmentKeys: string[]
  files: TServiceConfigFile[]
}

export type TServiceConfigContent = {
  serviceId: string
  fileId: string
  content: string
  redacted: boolean
}

export type TServerMetricSnapshot = {
  at: number
  runId: string
  cpuPercent: number
  rssBytes: number
  processCount: number
  cpuCritical: boolean
  rssCritical: boolean
}

export type TBrowserMetricSnapshot = {
  at: number
  pageId: string
  url: string
  visibility: 'visible' | 'hidden'
  heapBytes: number | null
  busyPercent: number | null
  heapCritical: boolean
  busyCritical: boolean
}

export type TServiceMetricsSnapshot = {
  serviceId: string
  server: TServerMetricSnapshot | null
  browser: TBrowserMetricSnapshot | null
  browserPageCount: number
}

export type TMetricStorageNotice = {
  serviceId: string
  serviceName: string
  sizeBytes: number
  limitBytes: number
  recordingPaused: boolean
}

type TMetricSampleBase = {
  v: 1
  kind: 'sample'
  at: number
  serviceId: string
}

export type TServerMetricSample = TMetricSampleBase & {
  source: 'server'
  runId: string
  cpuPercent: number
  rssBytes: number
  processCount: number
}

export type TBrowserMetricSample = TMetricSampleBase & {
  source: 'browser'
  pageId: string
  url: string
  visibility: 'visible' | 'hidden'
  heapBytes: number | null
  busyPercent: number | null
}

export type TMetricSample = TServerMetricSample | TBrowserMetricSample

export type TMetricRange = '15m' | '1h' | '6h' | '24h'

export type TMetricHistoryPayload = {
  serviceId: string
  from: number
  to: number
  bucketMs: number
  samples: TMetricSample[]
}

export type TBrowserMetricReport = {
  serviceId: string
  pageId: string
  url: string
  visibility: 'visible' | 'hidden'
  heapBytes: number | null
  busyPercent: number | null
  sampleWindowMs: number
}

export type THubEvent =
  | { type: 'status'; service: TPublicService }
  | { type: 'log'; serviceId: string; log: TServiceLog }
  | { type: 'git'; git: TGitSnapshot }
  | { type: 'metrics'; serviceId: string; metrics: TServiceMetricsSnapshot }
  | { type: 'metric-notices'; notices: TMetricStorageNotice[] }

export type THubSnapshot = {
  services: TPublicService[]
  relations: TServiceRelation[]
  git: TGitSnapshot
  metrics: Record<string, TServiceMetricsSnapshot>
  metricNotices: TMetricStorageNotice[]
}
