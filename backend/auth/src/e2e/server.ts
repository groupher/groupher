import GitHub from '@auth/core/providers/github'
import { serve } from '@hono/node-server'

import '../env'
import { createApp } from '../app'
import { createAuthRequestHandler } from '../auth'
import { createE2ERateLimiter } from './rate-limiter'
import { testLogin } from './test-login'

const port = Number.parseInt(process.env.PORT || '3104', 10)
const refreshRateLimiter = createE2ERateLimiter()
const mockOrigin = 'http://127.0.0.1:4104'
const authHandler = createAuthRequestHandler({
  resolveRedirect: ({ url, baseUrl }) => {
    const target = new URL(url, baseUrl)
    return [
      'http://dash.groupher.localhost:3103',
      'http://community.groupher.localhost:3107',
      'http://auth.groupher.localhost:3104',
    ].includes(target.origin)
      ? target.toString()
      : baseUrl
  },
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      authorization: `${mockOrigin}/mock-oauth/authorize`,
      token: `${mockOrigin}/mock-oauth/token`,
      userinfo: `${mockOrigin}/mock-oauth/user`,
    }),
  ],
})
const app = createApp({ authHandler, refreshRateLimiter, testLogin })

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
