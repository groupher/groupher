import { createFileRoute } from '@tanstack/react-router'

const startedAt = Date.now()

export const Route = createFileRoute('/health')({
  server: {
    handlers: {
      GET: () =>
        Response.json({
          schemaVersion: 'health.v1',
          status: 'ok',
          service: 'apply',
          version: import.meta.env.VITE_GIT_COMMIT_SHA || 'dev',
          environment: import.meta.env.PROD ? 'production' : 'development',
          timestamp: new Date().toISOString(),
          uptimeMs: Date.now() - startedAt,
          checks: [],
        }),
    },
  },
})
