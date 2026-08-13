/**
 * Composes the Auth HTTP application and its injected route dependencies.
 *
 * Business position:
 *
 *   Browser / Gateway
 *     -> Auth module
 *     -> OAuth provider / Phoenix Accounts
 *     -> Session cookies or service token
 */

import { GROUPHER_AUTH_CSRF_HEADER, GROUPHER_AUTH_CSRF_VALUE } from '@groupher/contracts/auth'
import { createHealthResponse } from '@groupher/service/health'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serialize } from 'hono/utils/cookie'

import {
  appendPhoenixTokenCookie,
  buildAuthCookieClearingHeaders,
  exchangeGithubCodeForIdentity,
  githubAuthorizationUrl,
  handleAuthRequest,
  listBrowserSessions,
  listLinkedOauthAccounts,
  linkOauthIdentity,
  readBrowserSession,
  readPhoenixUserToken,
  refreshBrowserSession,
  PhoenixBrowserSessionError,
  revokeBrowserSession,
  revokeBrowserSessionPublic,
  revokeOtherBrowserSessions,
  unlinkOauthIdentity,
  useSecureCookies,
  type TLinkedOauthAccount,
} from './auth'
import {
  createLinkIntent,
  decodeLinkState,
  DurableLinkIntentStore,
  encodeLinkState,
  type TLinkIntentNamespace,
  type TLinkIntentStore,
} from './link-intent'
import { createMemoryRateLimiter, type TRateLimitBinding } from './rate-limit'
import { issueServiceToken, serviceJwks } from './service-auth'

type TBindings = {
  AUTH_OAUTH_RATE_LIMITER?: TRateLimitBinding
  AUTH_REFRESH_RATE_LIMITER?: TRateLimitBinding
  LINK_INTENTS?: TLinkIntentNamespace
  SERVICE_TOKEN_RATE_LIMITER?: TRateLimitBinding
}

type TOptions = {
  authHandler?: (request: Request) => Promise<Response>
  listBrowserSessions?: typeof listBrowserSessions
  listLinkedOauthAccounts?: typeof listLinkedOauthAccounts
  linkOauthIdentity?: typeof linkOauthIdentity
  exchangeGithubCodeForIdentity?: typeof exchangeGithubCodeForIdentity
  linkIntentStore?: TLinkIntentStore
  readBrowserSession?: typeof readBrowserSession
  refreshBrowserSession?: typeof refreshBrowserSession
  revokeBrowserSession?: typeof revokeBrowserSession
  revokeBrowserSessionPublic?: typeof revokeBrowserSessionPublic
  revokeOtherBrowserSessions?: typeof revokeOtherBrowserSessions
  unlinkOauthIdentity?: typeof unlinkOauthIdentity
  refreshRateLimiter?: TRateLimitBinding
  oauthRateLimiter?: TRateLimitBinding
  serviceTokenRateLimiter?: TRateLimitBinding
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

/** Reports whether allowed auth origin at the auth boundary. */
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

/** Maps browser session error into the public auth result shape. */
export const mapBrowserSessionError = (
  error: unknown,
  fallbackCode: string,
): { code: string; status: 401 | 403 | 404 | 409 | 429 | 503 } => {
  if (error instanceof PhoenixBrowserSessionError) {
    if (error.code === 'SESSION_REVOKED' || error.code === 'SESSION_EXPIRED') {
      return { code: error.code, status: 401 }
    }
    if (error.code === 'TOKEN_INVALID' || error.code === 'TOKEN_EXPIRED') {
      return { code: error.code, status: 401 }
    }
    if (error.code === 'ACCOUNT_BLOCKED') return { code: error.code, status: 403 }
    if (error.code === 'SESSION_CONFLICT') return { code: error.code, status: 409 }
    if (error.code === 'RATE_LIMITED') return { code: error.code, status: 429 }
    if (error.code === 'OAUTH_BINDING_NOT_FOUND') return { code: error.code, status: 404 }
    if (
      error.code === 'OAUTH_IDENTITY_ALREADY_LINKED' ||
      error.code === 'OAUTH_PROVIDER_ALREADY_LINKED' ||
      error.code === 'OAUTH_LAST_LOGIN_METHOD'
    ) {
      return { code: error.code, status: 409 }
    }
  }

  return { code: fallbackCode, status: 503 }
}

/** Creates the auth application with injectable runtime dependencies. */
export const createApp = ({
  authHandler = handleAuthRequest,
  listBrowserSessions: listSessions = listBrowserSessions,
  listLinkedOauthAccounts: listAccounts = listLinkedOauthAccounts,
  linkOauthIdentity: linkIdentity = linkOauthIdentity,
  exchangeGithubCodeForIdentity: exchangeGithubIdentity = exchangeGithubCodeForIdentity,
  linkIntentStore,
  readBrowserSession: readSession = readBrowserSession,
  refreshBrowserSession: refreshSession = refreshBrowserSession,
  revokeBrowserSession: revokeSession = revokeBrowserSession,
  revokeBrowserSessionPublic: revokeSessionPublic = revokeBrowserSessionPublic,
  revokeOtherBrowserSessions: revokeOtherSessions = revokeOtherBrowserSessions,
  unlinkOauthIdentity: unlinkIdentity = unlinkOauthIdentity,
  refreshRateLimiter,
  oauthRateLimiter,
  serviceTokenRateLimiter,
  testLogin,
}: TOptions = {}) => {
  const app = new Hono<{ Bindings: TBindings }>()
  const fallbackRefreshRateLimiter = createMemoryRateLimiter()
  const fallbackOauthRateLimiter = createMemoryRateLimiter()
  const fallbackServiceTokenRateLimiter = createMemoryRateLimiter()
  const resolveLinkIntentStore = (env: TBindings): TLinkIntentStore | undefined =>
    linkIntentStore || (env.LINK_INTENTS ? new DurableLinkIntentStore(env.LINK_INTENTS) : undefined)
  const resolveOauthRateLimiter = (env: TBindings): TRateLimitBinding =>
    oauthRateLimiter || env.AUTH_OAUTH_RATE_LIMITER || fallbackOauthRateLimiter
  const limitOauth = async (env: TBindings, key: string): Promise<boolean> =>
    (await resolveOauthRateLimiter(env).limit({ key })).success
  const linkIntentCookie = () => `${useSecureCookies ? '__Host-' : ''}groupher-auth.link-intent`
  const clearLinkIntentCookie = () =>
    serialize(linkIntentCookie(), '', {
      httpOnly: true,
      maxAge: 0,
      path: '/',
      sameSite: 'lax',
      secure: useSecureCookies,
    })
  const setLinkIntentCookie = (intentRef: string) =>
    serialize(linkIntentCookie(), intentRef, {
      httpOnly: true,
      maxAge: 600,
      path: '/',
      sameSite: 'lax',
      secure: useSecureCookies,
    })
  const requestCookie = (request: Request, name: string): string | null => {
    const cookie = request.headers.get('cookie')
    if (!cookie) return null
    for (const part of cookie.split(';')) {
      const [key, ...values] = part.trim().split('=')
      if (key !== name) continue
      return values.join('=') || null
    }
    return null
  }
  const safeReturnTo = (request: Request, value: unknown): string => {
    const fallback = request.headers.get('origin') || process.env.AUTH_URL || 'https://groupher.com'
    if (typeof value !== 'string' || !value.trim()) return fallback
    try {
      const candidate = new URL(value, fallback)
      if (!isAllowedAuthOrigin(candidate.origin) || candidate.username || candidate.password) {
        return fallback
      }
      return candidate.toString()
    } catch {
      return fallback
    }
  }
  const providerRedirectUri = (provider: string): string => {
    const authUrl = process.env.AUTH_URL?.trim()
    if (!authUrl) throw new Error('Auth URL is not configured.')
    return new URL(`/api/auth/accounts/${provider}/callback`, authUrl).toString()
  }
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

  app.get('/.well-known/jwks.json', async (context) =>
    context.json(await serviceJwks(process.env), 200, { 'Cache-Control': 'public, max-age=300' }),
  )

  app.post('/oauth2/token', async (context) => {
    const limiter =
      serviceTokenRateLimiter ||
      context.env?.SERVICE_TOKEN_RATE_LIMITER ||
      fallbackServiceTokenRateLimiter
    const limit = await limiter.limit({
      key: `service-token:client:${clientRateLimitKey(context.req.raw)}`,
    })
    if (!limit.success) {
      return context.json(
        { error: 'slow_down', error_description: 'Too many token requests.' },
        429,
        retryAfter(),
      )
    }

    try {
      const result = await issueServiceToken(context.req.raw, process.env)
      if ('error' in result) {
        return context.json(result, result.status, noStore())
      }
      return context.json(result, 200, noStore())
    } catch {
      return context.json(
        {
          error: 'temporarily_unavailable',
          error_description: 'Service token issue is unavailable.',
        },
        503,
        noStore(),
      )
    }
  })

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

  app.post('/api/auth/accounts/:provider/link', async (context) => {
    if (!requireStateChangeOrigin(context)) {
      return context.json({ code: 'INVALID_ORIGIN' }, 400, noStore())
    }

    const clientKey = clientRateLimitKey(context.req.raw)
    if (!(await limitOauth(context.env || {}, `oauth:link:client:${clientKey}`))) {
      return context.json({ code: 'RATE_LIMITED' }, 429, retryAfter())
    }

    const provider = context.req.param('provider')
    if (provider !== 'github')
      return context.json({ code: 'OAUTH_PROVIDER_UNSUPPORTED' }, 400, noStore())

    const session = await readSession(context.req.raw)
    if (!session) return context.json({ code: 'SESSION_MISSING' }, 401, noStore())

    if (!(await limitOauth(context.env || {}, `oauth:link:session:${session.browserSessionRef}`))) {
      return context.json({ code: 'RATE_LIMITED' }, 429, retryAfter())
    }

    const userToken = readPhoenixUserToken(context.req.raw)
    if (!userToken) return context.json({ code: 'TOKEN_MISSING' }, 401, noStore())

    const store = resolveLinkIntentStore(context.env || {})
    if (!store) return context.json({ code: 'LINK_INTENT_UNAVAILABLE' }, 503, noStore())

    let body: unknown = {}
    try {
      body = await context.req.json()
    } catch {
      // Empty bodies are valid; the request origin is the default return target.
    }

    const intent = createLinkIntent({
      browserSessionRef: session.browserSessionRef,
      provider,
      returnTo: safeReturnTo(context.req.raw, (body as { returnTo?: unknown })?.returnTo),
    })

    try {
      await store.create(intent)
      const redirectUri = providerRedirectUri(provider)
      const location = githubAuthorizationUrl(
        encodeLinkState(intent),
        redirectUri,
        intent.codeVerifier,
      )
      context.header('Set-Cookie', setLinkIntentCookie(intent.intentRef))
      return context.json({ authorizationUrl: location }, 200, noStore())
    } catch {
      return context.json({ code: 'LINK_INTENT_UNAVAILABLE' }, 503, noStore())
    }
  })

  app.get('/api/auth/accounts/:provider/callback', async (context) => {
    const provider = context.req.param('provider')
    const state = context.req.query('state')
    const intentRef = requestCookie(context.req.raw, linkIntentCookie())
    const decodedState = state ? decodeLinkState(state) : null
    const store = resolveLinkIntentStore(context.env || {})

    const callbackKey = `${intentRef || decodedState?.intentRef || 'unknown'}:${clientRateLimitKey(context.req.raw)}`
    if (!(await limitOauth(context.env || {}, `oauth:callback:${callbackKey}`))) {
      return context.json({ code: 'RATE_LIMITED' }, 429, retryAfter())
    }

    if (
      provider !== 'github' ||
      !store ||
      !intentRef ||
      !decodedState ||
      decodedState.intentRef !== intentRef
    ) {
      return context.json({ code: 'OAUTH_LINK_INVALID_INTENT' }, 400, noStore())
    }

    const intent = await store.get(intentRef)
    if (!intent || intent.provider !== provider || intent.nonce !== decodedState.nonce) {
      return context.json({ code: 'OAUTH_LINK_INVALID_INTENT' }, 400, noStore())
    }

    const redirectWithResult = (
      params: { result: string; code?: string },
      refreshedSession?: Awaited<ReturnType<typeof refreshSession>>,
    ): Response => {
      const location = new URL(intent.returnTo)
      location.searchParams.set('oauthLink', params.result)
      if (params.code) location.searchParams.set('code', params.code)
      let response = new Response(null, {
        headers: new Headers({ ...noStore(), location: location.toString() }),
        status: 303,
      })
      if (refreshedSession) response = appendPhoenixTokenCookie(response, refreshedSession)
      const headers = new Headers(response.headers)
      headers.append('set-cookie', clearLinkIntentCookie())
      return new Response(response.body, { headers, status: 303 })
    }

    const session = await readSession(context.req.raw)
    const userToken = readPhoenixUserToken(context.req.raw)
    if (!session || session.browserSessionRef !== intent.browserSessionRef || !userToken) {
      return redirectWithResult({ result: 'error', code: 'SESSION_MISSING' })
    }

    const consumed = await store.consume(intentRef)
    if (!consumed) return redirectWithResult({ result: 'error', code: 'OAUTH_LINK_REPLAYED' })

    const providerError = context.req.query('error')
    if (providerError) return redirectWithResult({ result: 'cancelled' })

    const code = context.req.query('code')
    if (!code) return redirectWithResult({ result: 'error', code: 'OAUTH_LINK_INVALID_CALLBACK' })

    try {
      const identity = await exchangeGithubIdentity(
        code,
        providerRedirectUri(provider),
        intent.codeVerifier,
      )
      try {
        await linkIdentity(userToken, identity)
        return redirectWithResult({ result: 'success' })
      } catch (error) {
        if (!(error instanceof PhoenixBrowserSessionError) || error.code !== 'TOKEN_EXPIRED') {
          throw error
        }

        const refreshed = await refreshSession(intent.browserSessionRef)
        await linkIdentity(refreshed.accessToken, identity)
        return redirectWithResult({ result: 'success' }, refreshed)
      }
    } catch (error) {
      const failure = mapBrowserSessionError(error, 'OAUTH_LINK_UNAVAILABLE')
      return redirectWithResult({ result: 'error', code: failure.code })
    }
  })

  app.get('/api/auth/accounts', async (context) => {
    const session = await readSession(context.req.raw)
    if (!session) return context.json({ code: 'SESSION_MISSING' }, 401, noStore())

    if (
      !(await limitOauth(
        context.env || {},
        `oauth:accounts:${session.browserSessionRef}:${clientRateLimitKey(context.req.raw)}`,
      ))
    ) {
      return context.json({ code: 'RATE_LIMITED' }, 429, retryAfter())
    }

    const userToken = readPhoenixUserToken(context.req.raw)
    if (!userToken) return context.json({ code: 'TOKEN_MISSING' }, 401, noStore())

    try {
      const accounts = await listAccounts(userToken)
      return context.json(
        { accounts } satisfies { accounts: TLinkedOauthAccount[] },
        200,
        noStore(),
      )
    } catch (error) {
      const failure = mapBrowserSessionError(error, 'OAUTH_ACCOUNTS_UNAVAILABLE')
      return context.json({ code: failure.code }, failure.status, noStore())
    }
  })

  app.post('/api/auth/accounts/:publicRef/unlink', async (context) => {
    if (!requireStateChangeOrigin(context)) {
      return context.json({ code: 'INVALID_ORIGIN' }, 400, noStore())
    }

    const session = await readSession(context.req.raw)
    if (!session) return context.json({ code: 'SESSION_MISSING' }, 401, noStore())

    if (
      !(await limitOauth(
        context.env || {},
        `oauth:unlink:${session.browserSessionRef}:${clientRateLimitKey(context.req.raw)}`,
      ))
    ) {
      return context.json({ code: 'RATE_LIMITED' }, 429, retryAfter())
    }

    const userToken = readPhoenixUserToken(context.req.raw)
    if (!userToken) return context.json({ code: 'TOKEN_MISSING' }, 401, noStore())

    const publicRef = context.req.param('publicRef')

    const isAmbiguousFailure = (error: unknown): boolean =>
      error instanceof PhoenixBrowserSessionError &&
      (error.code === 'PHOENIX_NETWORK_ERROR' || (error.upstreamStatus ?? 0) >= 500)

    const unlinkWithReconciliation = async (): Promise<TLinkedOauthAccount[]> => {
      try {
        return await unlinkIdentity(userToken, publicRef)
      } catch (error) {
        if (!isAmbiguousFailure(error)) throw error

        const currentAccounts = await listAccounts(userToken)
        if (!currentAccounts.some((account) => account.publicRef === publicRef)) {
          return currentAccounts
        }

        return unlinkIdentity(userToken, publicRef)
      }
    }

    try {
      const accounts = await unlinkWithReconciliation()
      return context.json(
        { accounts } satisfies { accounts: TLinkedOauthAccount[] },
        200,
        noStore(),
      )
    } catch (error) {
      const failure = mapBrowserSessionError(error, 'OAUTH_UNLINK_UNAVAILABLE')
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
