import { GROUPHER_AUTH_CSRF_HEADER, GROUPHER_AUTH_CSRF_VALUE } from '@groupher/contracts/auth'
import { createHealthResponse } from '@groupher/service/health'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import {
  appendPhoenixTokenCookie,
  buildAuthCookieClearingHeaders,
  handleAuthRequest,
  listBrowserSessions,
  readBrowserSession,
  refreshBrowserSession,
  PhoenixBrowserSessionError,
  revokeBrowserSession,
  revokeBrowserSessionPublic,
  revokeOtherBrowserSessions,
} from './auth'
import { createMemoryRateLimiter, type TRateLimitBinding } from './rate-limit'

type TBindings = {
  AUTH_REFRESH_RATE_LIMITER?: TRateLimitBinding
}

type TOptions = {
  authHandler?: (request: Request) => Promise<Response>
  listBrowserSessions?: typeof listBrowserSessions
  readBrowserSession?: typeof readBrowserSession
  refreshBrowserSession?: typeof refreshBrowserSession
  revokeBrowserSession?: typeof revokeBrowserSession
  revokeBrowserSessionPublic?: typeof revokeBrowserSessionPublic
  revokeOtherBrowserSessions?: typeof revokeOtherBrowserSessions
  refreshRateLimiter?: TRateLimitBinding
  testLogin?: (request: Request) => Promise<Response>
}

const FIRST_PARTY_AUTH_HOSTS = new Set([
  'groupher.com',
  'main.groupher.com',
  'dashboard.groupher.com',
  'dash.groupher.com',
])

const LOCAL_AUTH_HOSTS = new Set([
  'groupher.localhost',
  'main.groupher.localhost',
  'dashboard.groupher.localhost',
  'dash.groupher.localhost',
])

const isAllowedLocalAuthOrigin = (url: URL): boolean => {
  if (!['http:', 'https:'].includes(url.protocol)) return false

  return LOCAL_AUTH_HOSTS.has(url.hostname) && (url.port === '' || url.port === '443')
}

export const isAllowedAuthOrigin = (origin: string): boolean => {
  try {
    const url = new URL(origin)
    const configuredTestOrigins = new Set(
      process.env.NODE_ENV !== 'production'
        ? (process.env.AUTH_TEST_ALLOWED_ORIGINS || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
    )
    if (configuredTestOrigins.has(url.origin)) return true
    if (process.env.NODE_ENV !== 'production' && isAllowedLocalAuthOrigin(url)) return true

    return url.protocol === 'https:' && url.port === '' && FIRST_PARTY_AUTH_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}

const requireStateChangeOrigin = (context: {
  req: { header: (name: string) => string | undefined }
}) => {
  const origin = context.req.header('origin')
  if (!origin || !isAllowedAuthOrigin(origin)) return false
  return context.req.header(GROUPHER_AUTH_CSRF_HEADER) === GROUPHER_AUTH_CSRF_VALUE
}

const noStore = (): Record<string, string> => ({ 'Cache-Control': 'no-store' })

const retryAfter = (): Record<string, string> => ({ ...noStore(), 'Retry-After': '60' })

const clientRateLimitKey = (request: Request): string => {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return request.headers.get('cf-connecting-ip') || forwardedFor || 'unknown-client'
}

export const mapBrowserSessionError = (
  error: unknown,
  fallbackCode: string,
): { code: string; status: 401 | 403 | 409 | 429 | 503 } => {
  if (error instanceof PhoenixBrowserSessionError) {
    if (error.code === 'SESSION_REVOKED' || error.code === 'SESSION_EXPIRED') {
      return { code: error.code, status: 401 }
    }
    if (error.code === 'ACCOUNT_BLOCKED') return { code: error.code, status: 403 }
    if (error.code === 'SESSION_CONFLICT') return { code: error.code, status: 409 }
    if (error.code === 'RATE_LIMITED') return { code: error.code, status: 429 }
  }

  return { code: fallbackCode, status: 503 }
}

export const createApp = ({
  authHandler = handleAuthRequest,
  listBrowserSessions: listSessions = listBrowserSessions,
  readBrowserSession: readSession = readBrowserSession,
  refreshBrowserSession: refreshSession = refreshBrowserSession,
  revokeBrowserSession: revokeSession = revokeBrowserSession,
  revokeBrowserSessionPublic: revokeSessionPublic = revokeBrowserSessionPublic,
  revokeOtherBrowserSessions: revokeOtherSessions = revokeOtherBrowserSessions,
  refreshRateLimiter,
  testLogin,
}: TOptions = {}) => {
  const app = new Hono<{ Bindings: TBindings }>()
  const fallbackRefreshRateLimiter = createMemoryRateLimiter()
  const authCors = cors({
    allowHeaders: ['content-type', 'x-auth-return-redirect', GROUPHER_AUTH_CSRF_HEADER],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    exposeHeaders: ['Retry-After'],
    maxAge: 600,
    origin: (origin) => (isAllowedAuthOrigin(origin) ? origin : null),
  })

  app.use('/api/auth', authCors)
  app.use('/api/auth/*', authCors)

  app.get('/health', (context) => context.json(createHealthResponse({ service: 'auth' })))

  if (testLogin) {
    app.post('/api/auth/test-login', async (context) => {
      if (!requireStateChangeOrigin(context)) {
        return context.json({ code: 'INVALID_ORIGIN' }, 400, noStore())
      }

      return testLogin(context.req.raw)
    })
  }

  app.get('/api/auth/session', async (context) => {
    const session = await readSession(context.req.raw)
    return session
      ? new Response(null, { headers: noStore(), status: 204 })
      : Response.json({ code: 'SESSION_MISSING' }, { headers: noStore(), status: 401 })
  })

  app.post('/api/auth/token/refresh', async (context) => {
    if (!requireStateChangeOrigin(context)) {
      return context.json({ code: 'INVALID_ORIGIN' }, 400, noStore())
    }

    const limiter =
      refreshRateLimiter || context.env?.AUTH_REFRESH_RATE_LIMITER || fallbackRefreshRateLimiter
    const clientLimit = await limiter.limit({
      key: `refresh:client:${clientRateLimitKey(context.req.raw)}`,
    })
    if (!clientLimit.success) {
      return context.json({ code: 'RATE_LIMITED' }, 429, retryAfter())
    }

    const session = await readSession(context.req.raw)
    if (!session) return context.json({ code: 'SESSION_MISSING' }, 401, noStore())

    const sessionLimit = await limiter.limit({
      key: `refresh:session:${session.browserSessionRef}`,
    })
    if (!sessionLimit.success) {
      return context.json({ code: 'RATE_LIMITED' }, 429, retryAfter())
    }

    try {
      const result = await refreshSession(session.browserSessionRef)
      return appendPhoenixTokenCookie(
        new Response(null, { headers: noStore(), status: 204 }),
        result,
      )
    } catch (error) {
      const failure = mapBrowserSessionError(error, 'REFRESH_UNAVAILABLE')
      if (failure.status === 401 || failure.status === 403) {
        for (const cookie of buildAuthCookieClearingHeaders(context.req.raw)) {
          context.header('Set-Cookie', cookie, { append: true })
        }
      }
      return context.json(
        { code: failure.code },
        failure.status,
        failure.status === 429 ? retryAfter() : noStore(),
      )
    }
  })

  app.get('/api/auth/sessions', async (context) => {
    const session = await readSession(context.req.raw)
    if (!session) return context.json({ code: 'SESSION_MISSING' }, 401, noStore())

    try {
      return context.json(await listSessions(session.browserSessionRef), 200, noStore())
    } catch (error) {
      const failure = mapBrowserSessionError(error, 'SESSION_UNAVAILABLE')
      return context.json({ code: failure.code }, failure.status, noStore())
    }
  })

  app.post('/api/auth/sessions/revoke-others', async (context) => {
    if (!requireStateChangeOrigin(context)) {
      return context.json({ code: 'INVALID_ORIGIN' }, 400, noStore())
    }
    const session = await readSession(context.req.raw)
    if (!session) return context.json({ code: 'SESSION_MISSING' }, 401, noStore())

    try {
      await revokeOtherSessions(session.browserSessionRef)
      return new Response(null, { headers: noStore(), status: 204 })
    } catch (error) {
      const failure = mapBrowserSessionError(error, 'SESSION_UNAVAILABLE')
      return context.json({ code: failure.code }, failure.status, noStore())
    }
  })

  app.post('/api/auth/sessions/:publicRef/revoke', async (context) => {
    if (!requireStateChangeOrigin(context)) {
      return context.json({ code: 'INVALID_ORIGIN' }, 400, noStore())
    }
    const session = await readSession(context.req.raw)
    if (!session) return context.json({ code: 'SESSION_MISSING' }, 401, noStore())

    try {
      await revokeSessionPublic(session.browserSessionRef, context.req.param('publicRef'))
      return new Response(null, { headers: noStore(), status: 204 })
    } catch (error) {
      const failure = mapBrowserSessionError(error, 'SESSION_UNAVAILABLE')
      return context.json({ code: failure.code }, failure.status, noStore())
    }
  })

  app.post('/api/auth/logout', async (context) => {
    if (!requireStateChangeOrigin(context)) {
      return context.json({ code: 'INVALID_ORIGIN' }, 400, noStore())
    }

    const session = await readSession(context.req.raw)
    if (session) {
      try {
        await revokeSession(session.browserSessionRef)
      } catch (error) {
        const failure = mapBrowserSessionError(error, 'LOGOUT_UNAVAILABLE')
        return context.json({ code: failure.code }, failure.status, noStore())
      }
    }

    for (const cookie of buildAuthCookieClearingHeaders(context.req.raw)) {
      context.header('Set-Cookie', cookie, { append: true })
    }
    context.header('Cache-Control', 'no-store')
    return new Response(null, { status: 204 })
  })

  app.on(['GET', 'POST'], '/api/auth', (context) => authHandler(context.req.raw))
  app.on(['GET', 'POST'], '/api/auth/*', (context) => authHandler(context.req.raw))

  return app
}

export default createApp()
