import { Hono } from 'hono'

import { buildPhoenixTokenCookie, handleAuthRequest } from './auth'

type TOptions = {
  authHandler?: (request: Request) => Promise<Response>
}

export const createApp = ({ authHandler = handleAuthRequest }: TOptions = {}) => {
  const app = new Hono()

  app.get('/health', (context) => context.json({ ok: true, service: 'auth' }))

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
