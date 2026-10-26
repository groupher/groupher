/**
 * Starts the local Node server for Press.
 *
 * Business position:
 *
 *   Browser / Gateway
 *     -> Press module
 *     -> cache / Phoenix projection
 *     -> public response
 */

import { createHealthResponse } from '@groupher/service/health'
import { serve } from '@hono/node-server'

import './env'
import { databaseUrlFromEnv } from './db/client'
import { handlePressRequest } from './runtime'

const environment = { ...process.env, DATABASE_URL: databaseUrlFromEnv(process.env) }

const fetch = async (request: Request): Promise<Response> => {
  const url = new URL(request.url)
  if (request.method === 'GET' && url.pathname === '/health') {
    return Response.json(createHealthResponse({ service: 'press' }), {
      headers: { 'cache-control': 'no-store' },
    })
  }

  return handlePressRequest(request, environment, {
    routes:
      request.method === 'POST' && url.pathname === '/internal/invalidate' ? 'internal' : 'public',
  })
}

const port = Number.parseInt(process.env.PORT || '8003', 10)
const hostname =
  process.env.HOST?.trim() || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1')

const server = serve({ fetch, hostname, port }, (info) => {
  console.log(`Press is ready at http://${hostname}:${info.port}`)
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
