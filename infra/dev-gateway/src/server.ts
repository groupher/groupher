/**
 * Starts the local Node server for Dev Gateway.
 *
 * Business position:
 *
 *   Browser / service
 *     -> Dev Gateway module
 *     -> selected Groupher application
 *     -> proxied response
 */

import { serve } from '@hono/node-server'

import './env'
import app from './app'
import { proxyUpgradeRequest } from './upgrade'

const port = Number.parseInt(process.env.PORT || '3003', 10)
const hostname =
  process.env.HOST?.trim() || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1')

const server = serve({ fetch: app.fetch, hostname, port }, (info) => {
  console.log(`Dev Gateway is ready at http://${hostname}:${info.port}`)
})

server.on('upgrade', proxyUpgradeRequest)

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
