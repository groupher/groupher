import {
  SERVICE_HEALTH_SCHEMA_VERSION,
  type TServiceHealthCheck,
  type TServiceHealthResponseV1,
  type TServiceHealthStatus,
} from '@groupher/contracts/health'

type TCreateHealthResponseOptions = {
  checks?: TServiceHealthCheck[]
  environment?: string
  service: string
  status?: TServiceHealthStatus
  version?: string
}

export const createHealthResponse = ({
  checks = [],
  environment = process.env.NODE_ENV || 'development',
  service,
  status = 'ok',
  version = process.env.VERCEL_GIT_COMMIT_SHA || process.env.npm_package_version || 'dev',
}: TCreateHealthResponseOptions): TServiceHealthResponseV1 => ({
  schemaVersion: SERVICE_HEALTH_SCHEMA_VERSION,
  status,
  service,
  version,
  environment,
  timestamp: new Date().toISOString(),
  uptimeMs: Math.round(process.uptime() * 1000),
  checks,
})
