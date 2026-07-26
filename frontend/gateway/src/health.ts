const SERVICE_ID = 'gateway'

export const buildHealthResponse = () => ({
  schemaVersion: 'health.v1',
  status: 'ok',
  service: SERVICE_ID,
  version: process.env.VERCEL_GIT_COMMIT_SHA || process.env.npm_package_version || 'dev',
  environment: process.env.NODE_ENV || 'development',
  timestamp: new Date().toISOString(),
  uptimeMs: Math.round(process.uptime() * 1000),
  checks: [],
})
