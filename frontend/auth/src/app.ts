import { Hono } from 'hono'

import { buildPhoenixTokenCookie, handleAuthRequest } from './auth'

type TOptions = {
  authHandler?: (request: Request) => Promise<Response>
}

const startedAt = Date.now()

const buildHealthResponse = () => ({
  schemaVersion: 'health.v1',
  status: 'ok',
  service: 'auth',
  version: process.env.VERCEL_GIT_COMMIT_SHA || process.env.npm_package_version || 'dev',
  environment: process.env.NODE_ENV || 'development',
  timestamp: new Date().toISOString(),
  uptimeMs: Date.now() - startedAt,
  checks: [],
})

export const createApp = ({ authHandler = handleAuthRequest }: TOptions = {}) => {
  const app = new Hono()

  app.get('/health', (context) => context.json(buildHealthResponse()))

  app.post('/api/auth/logout', (context) => {
    context.header('Cache-Control', 'no-store')
    context.header('Set-Cookie', buildPhoenixTokenCookie('', 0), { append: true })
    return context.json({ ok: true })
  })

  app.on(['GET', 'POST'], '/api/auth', (context) => authHandler(context.req.raw))
  app.on(['GET', 'POST'], '/api/auth/*', (context) => authHandler(context.req.raw))

  return app
}

export default createApp()
