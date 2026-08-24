export const SERVICE_HEALTH_SCHEMA_VERSION = 'health.v1'

export const SERVICE_HEALTH_SERVICES = [
  'gateway',
  'edge-router',
  'auth',
  'landing',
  'main',
  'community',
  'dashboard',
  'dash',
  'inspire-me',
  'phoenix',
  'press',
  'assets-hub',
  'content-import',
  'document-converter',
] as const

export type TServiceHealthService = (typeof SERVICE_HEALTH_SERVICES)[number]

export type TServiceHealthStatus = 'ok' | 'limited' | 'down'

export type TServiceHealthCheck = {
  name: string
  status: TServiceHealthStatus
  latencyMs?: number
  message?: string
}

export type TServiceHealthResponseV1 = {
  schemaVersion: typeof SERVICE_HEALTH_SCHEMA_VERSION
  status: TServiceHealthStatus
  service: TServiceHealthService
  version: string
  environment: string
  timestamp: string
  uptimeMs: number
  checks: TServiceHealthCheck[]
}
