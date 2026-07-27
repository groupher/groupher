import { Hono } from 'hono'

import { buildAuthCookieClearingHeaders, handleAuthRequest } from './auth'

type TOptions = {
  authHandler?: (request: Request) => Promise<Response>
}

const buildHealthResponse = () => ({
  schemaVersion: 'health.v1',
  status: 'ok',
  service: 'auth',
  version: process.env.VERCEL_GIT_COMMIT_SHA || process.env.npm_package_version || 'dev',
  environment: process.env.NODE_ENV || 'development',
  timestamp: new Date().toISOString(),
  uptimeMs: Math.round(process.uptime() * 1000),
  checks: [],
})

export const createApp = ({ authHandler = handleAuthRequest }: TOptions = {}) => {
  const app = new Hono()

  app.get('/health', (context) => context.json(buildHealthResponse()))

  app.post('/api/auth/logout', (context) => {
    context.header('Cache-Control', 'no-store')
    for (const cookie of buildAuthCookieClearingHeaders(context.req.raw)) {
      context.header('Set-Cookie', cookie, { append: true })
    }
    return context.json({ ok: true })
  })

  app.on(['GET', 'POST'], '/api/auth', (context) => authHandler(context.req.raw))
  app.on(['GET', 'POST'], '/api/auth/*', (context) => authHandler(context.req.raw))

  return app
}

export default createApp()
