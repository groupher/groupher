export const SERVICE_HEALTH_SCHEMA_VERSION = 'health.v1'

export type TServiceHealthStatus = 'ok' | 'degraded' | 'error'

export type TServiceHealthCheck = {
  name: string
  status: TServiceHealthStatus
  message?: string
}

export type TServiceHealthResponseV1 = {
  schemaVersion: typeof SERVICE_HEALTH_SCHEMA_VERSION
  status: TServiceHealthStatus
  service: string
  version: string
  environment: string
  timestamp: string
  uptimeMs: number
  checks: TServiceHealthCheck[]
}
