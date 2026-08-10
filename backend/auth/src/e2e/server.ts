import { serve } from '@hono/node-server'

import '../env'
import { createApp } from '../app'
import { createE2ERateLimiter } from './rate-limiter'
import { testLogin } from './test-login'

const port = Number.parseInt(process.env.PORT || '3104', 10)
const refreshRateLimiter = createE2ERateLimiter()
const app = createApp({ refreshRateLimiter, testLogin })

app.post('/__e2e/reset', (context) => {
  refreshRateLimiter.reset()
  return context.json({ ok: true })
})

const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port }, (info) => {
  console.log(`Auth E2E is ready at http://127.0.0.1:${info.port}`)
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
