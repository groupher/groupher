import { createFileRoute } from '@tanstack/react-router'

let startedAt = 0

const healthResponse = () => {
  const now = Date.now()
  if (startedAt === 0) startedAt = now

  return Response.json({
    schemaVersion: 'health.v1',
    status: 'ok',
    service: 'dash',
    version: import.meta.env.VITE_GIT_COMMIT_SHA || 'dev',
    environment: import.meta.env.PROD ? 'production' : 'development',
    timestamp: new Date(now).toISOString(),
    uptimeMs: now - startedAt,
    checks: [],
  })
}

export const Route = createFileRoute('/health')({
  server: {
    handlers: {
      GET: healthResponse,
    },
  },
})
