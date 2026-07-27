import { createHealthResponse } from '@groupher/service/health'
import { Hono } from 'hono'

import { buildAuthCookieClearingHeaders, handleAuthRequest } from './auth'

type TOptions = {
  authHandler?: (request: Request) => Promise<Response>
}

export const createApp = ({ authHandler = handleAuthRequest }: TOptions = {}) => {
  const app = new Hono()

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
