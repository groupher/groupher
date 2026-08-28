/**
 * Starts the local Node server for Content Import.
 *
 * Business position:
 *
 *   Dash proxy / Phoenix import job
 *     -> Content Import module
 *     -> canonical source tree / apply batch
 *     -> Phoenix persistence boundary
 */

import { serve } from '@hono/node-server'

import './env'
import app from './service-app'

const port = Number.parseInt(process.env.PORT || '8001', 10)
const hostname =
  process.env.HOST?.trim() || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1')

const server = serve({ fetch: app.fetch, hostname, port }, (info) => {
  console.log(`Content Import is ready at http://${hostname}:${info.port}`)
})

const shutdown = () => {
  server.close((error) => {
    if (error) {
      console.error(error)
      process.exitCode = 1
    }
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
