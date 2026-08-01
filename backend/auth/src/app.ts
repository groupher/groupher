import { createHealthResponse } from '@groupher/service/health'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { buildAuthCookieClearingHeaders, handleAuthRequest } from './auth'

type TOptions = {
  authHandler?: (request: Request) => Promise<Response>
}

const FIRST_PARTY_AUTH_HOSTS = new Set([
  'groupher.com',
  'www.groupher.com',
  'main.groupher.com',
  'dashboard.groupher.com',
  'landing.groupher.com',
])

const isAllowedLocalAuthOrigin = (url: URL): boolean => {
  if (!['http:', 'https:'].includes(url.protocol)) return false

  return (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname.endsWith('.localhost')
  )
}

const isAllowedAuthOrigin = (origin: string): boolean => {
  try {
    const url = new URL(origin)
    if (isAllowedLocalAuthOrigin(url)) return true

    return url.protocol === 'https:' && FIRST_PARTY_AUTH_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}

export const createApp = ({ authHandler = handleAuthRequest }: TOptions = {}) => {
  const app = new Hono()
  const authCors = cors({
    allowHeaders: ['content-type', 'x-auth-return-redirect'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    origin: (origin) => (isAllowedAuthOrigin(origin) ? origin : null),
  })

  app.use('/api/auth', authCors)
  app.use('/api/auth/*', authCors)

  app.get('/health', (context) => context.json(createHealthResponse({ service: 'auth' })))

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
