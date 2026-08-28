import { createFileRoute } from '@tanstack/react-router'

const startedAt = Date.now()
const createHealthRoute = createFileRoute('/health')

const options = {
  server: {
    handlers: {
      GET: () => {
        const now = Date.now()
        return Response.json({
          schemaVersion: 'health.v1',
          status: 'ok',
          service: 'inspire-me',
          version: import.meta.env.VITE_GIT_COMMIT_SHA || 'dev',
          environment: import.meta.env.MODE || 'development',
          timestamp: new Date(now).toISOString(),
          uptimeMs: Math.max(0, now - startedAt),
          checks: [],
        })
      },
    },
  },
}

export const Route = createHealthRoute(
  options as unknown as Parameters<typeof createHealthRoute>[0],
)
