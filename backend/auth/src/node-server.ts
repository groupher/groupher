/**
 * Shared Node listener. Development handlers are supplied only by dev-server.ts.
 *
 * Business position:
 *   Node entrypoint -> supplied Auth app -> HTTP listener -> graceful shutdown
 */
import { serve } from '@hono/node-server'

import type { createApp } from './app'

/** Starts one Node Auth listener and registers graceful signal handling. */
export const startAuthServer = (app: ReturnType<typeof createApp>, bind?: { hostname: string }) => {
  const port = Number.parseInt(process.env.PORT || '3004', 10)
  const hostname =
    bind?.hostname ||
    process.env.HOST?.trim() ||
    (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1')
  const server = serve({ fetch: app.fetch, hostname, port }, (info) => {
    console.log(`Auth is ready at http://${hostname}:${info.port}`)
  })
  const shutdown = () =>
    server.close((error) => {
      if (error) {
        console.error(error)
        process.exitCode = 1
      }
    })
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}
