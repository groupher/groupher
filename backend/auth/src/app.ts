/**
 * Composes the Auth HTTP application and its injected route dependencies.
 *
 * Business position:
 *
 *   Browser / Gateway
 *     -> Auth route composition
 *     -> OAuth and Phoenix Accounts
 *     -> Session cookies or service token
 */

import {
  AUTH_ERROR,
  GROUPHER_AUTH_CSRF_HEADER,
  GROUPHER_AUTH_CSRF_VALUE,
  getAuthCookieNames,
} from '@groupher/contracts/auth'
import { isPagiInput } from '@groupher/contracts/pagination'
import { AUTH_ROUTE } from '@groupher/route-contract'
import { createHealthResponse } from '@groupher/service/health'
import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import { serialize } from 'hono/utils/cookie'

import {
  appendPhoenixTokenCookie,
  startOauthLink,
  claimOauthLink,
  verifyOauthLink,
  readOauthLink,
  confirmOauthLink,
  cancelOauthLink,
  completeOauthRegistration,
  createSignedInResponse,
  readOauthRegistration,
  buildAuthCookieClearingHeaders,
  handleAuthRequest,
  listBrowserSessions,
  listOauthProviders,
  listLinkedOauthAccounts,
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
import { createLinkIntent, decodeLinkState, encodeLinkState } from './link-intent'
import { OAUTH_PROVIDERS, oauthProvider, type TOauthProvider } from './oauth-providers'
import { createMemoryRateLimiter, type TRateLimitBinding } from './rate-limit'
import { issueServiceToken, serviceJwks } from './service-auth'

type TBindings = {
  AUTH_OAUTH_RATE_LIMITER?: TRateLimitBinding
  AUTH_REFRESH_RATE_LIMITER?: TRateLimitBinding
  SERVICE_TOKEN_RATE_LIMITER?: TRateLimitBinding
}

type TOptions = {
  authHandler?: (request: Request) => Promise<Response>
  startOauthLink?: typeof startOauthLink
  claimOauthLink?: typeof claimOauthLink
  verifyOauthLink?: typeof verifyOauthLink
  readOauthLink?: typeof readOauthLink
  confirmOauthLink?: typeof confirmOauthLink
  cancelOauthLink?: typeof cancelOauthLink
  readOauthRegistration?: typeof readOauthRegistration
  completeOauthRegistration?: typeof completeOauthRegistration
  createSignedInResponse?: typeof createSignedInResponse
  listBrowserSessions?: typeof listBrowserSessions
  listOauthProviders?: typeof listOauthProviders
  listLinkedOauthAccounts?: typeof listLinkedOauthAccounts
  oauthExchanges?: Partial<{ [K in TOauthProvider]: (typeof OAUTH_PROVIDERS)[K]['exchange'] }>
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

const AUTH_CORE_ACTIONS = new Set([
  'callback',
  'csrf',
  'error',
  'providers',
  'session',
  'signin',
  'signout',
  'verify-request',
  'webauthn-options',
])

const FIRST_PARTY_AUTH_HOSTS = new Set([
  'groupher.com',
  'community.groupher.com',
  'dash.groupher.com',
])

const LOCAL_AUTH_HOSTS = new Set([
  'groupher.localhost',
  'community.groupher.localhost',
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

const SERVICE_AUTH_PROBE_REF = 'dev-hub-service-auth-contract-probe'

const clientRateLimitKey = (request: Request): string => {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return request.headers.get('cf-connecting-ip') || forwardedFor || 'unknown-client'
}

/** Maps browser session error into the public auth result shape. */
export const mapBrowserSessionError = (
  error: unknown,
  fallbackCode: string,
): { code: string; status: 400 | 401 | 403 | 404 | 409 | 429 | 503 } => {
  if (error instanceof PhoenixBrowserSessionError) {
    if (error.code && /^PAGI_(420[0-9]|421[12])$/.test(error.code))
      return { code: error.code, status: 400 }
    if (error.code === AUTH_ERROR.SESSION_REVOKED || error.code === AUTH_ERROR.SESSION_EXPIRED) {
      return { code: error.code, status: 401 }
    }
    if (error.code === AUTH_ERROR.TOKEN_INVALID || error.code === AUTH_ERROR.TOKEN_EXPIRED) {
      return { code: error.code, status: 401 }
    }
    if (error.code === AUTH_ERROR.SERVICE_TOKEN_INVALID) return { code: error.code, status: 401 }
    if (error.code === AUTH_ERROR.SERVICE_SCOPE_FORBIDDEN) return { code: error.code, status: 403 }
    if (error.code === AUTH_ERROR.SERVICE_JWKS_UNAVAILABLE) return { code: error.code, status: 503 }
    if (error.code === AUTH_ERROR.ACCOUNT_BLOCKED) return { code: error.code, status: 403 }
    if (error.code === AUTH_ERROR.SESSION_CONFLICT) return { code: error.code, status: 409 }
    if (error.code === AUTH_ERROR.RATE_LIMITED) return { code: error.code, status: 429 }
    if (error.code === AUTH_ERROR.OAUTH_BINDING_NOT_FOUND) return { code: error.code, status: 404 }
    if (
      error.code === AUTH_ERROR.OAUTH_IDENTITY_ALREADY_LINKED ||
      error.code === AUTH_ERROR.OAUTH_PROVIDER_ALREADY_LINKED ||
      error.code === AUTH_ERROR.OAUTH_LAST_LOGIN_METHOD
    ) {
      return { code: error.code, status: 409 }
    }
  }

  return { code: fallbackCode, status: 503 }
}

const clearsBrowserSession = (code: string): boolean =>
  code === AUTH_ERROR.SESSION_REVOKED ||
  code === AUTH_ERROR.SESSION_EXPIRED ||
  code === AUTH_ERROR.TOKEN_INVALID ||
  code === AUTH_ERROR.TOKEN_EXPIRED ||
  code === AUTH_ERROR.ACCOUNT_BLOCKED

/** Creates the auth application with injectable runtime dependencies. */
export const createApp = ({
  authHandler = handleAuthRequest,
  listBrowserSessions: listSessions = listBrowserSessions,
  listLinkedOauthAccounts: listAccounts = listLinkedOauthAccounts,
  startOauthLink: startLink = startOauthLink,
  claimOauthLink: claimLink = claimOauthLink,
  verifyOauthLink: verifyLink = verifyOauthLink,
  readOauthLink: readLink = readOauthLink,
  confirmOauthLink: confirmLink = confirmOauthLink,
  cancelOauthLink: cancelLink = cancelOauthLink,
  listOauthProviders: listProviders = listOauthProviders,
  readOauthRegistration: readRegistration = readOauthRegistration,
  completeOauthRegistration: completeRegistration = completeOauthRegistration,
  createSignedInResponse: signedInResponse = createSignedInResponse,
  oauthExchanges,
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
    const origin = request.headers.get('origin')
    const fallback =
      (origin && isAllowedAuthOrigin(origin) ? origin : null) ||
      process.env.AUTH_URL ||
      'https://groupher.com'
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
    return new URL(AUTH_ROUTE.accountCallback(provider), authUrl).toString()
  }
  const authCors = cors({
    allowHeaders: ['content-type', 'x-auth-return-redirect', GROUPHER_AUTH_CSRF_HEADER],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    exposeHeaders: ['Retry-After'],
    maxAge: 600,
    origin: (origin) => (isAllowedAuthOrigin(origin) ? origin : null),
  })

  app.use(AUTH_ROUTE.ROOT, authCors)
  app.use(AUTH_ROUTE.WILDCARD, authCors)

  app.get('/health', (context) => context.json(createHealthResponse({ service: 'auth' })))

  app.get('/health/service-auth', async (context) => {
    if (process.env.DEV_HUB_SERVICE_AUTH_PROBE !== 'true') return context.notFound()

    const startedAt = performance.now()
    try {
      await refreshSession(SERVICE_AUTH_PROBE_REF)
      return context.json(
        createHealthResponse({
          service: 'auth',
          status: 'down',
          checks: [
            {
              name: 'phoenix-service-auth',
              status: 'down',
              latencyMs: Math.round(performance.now() - startedAt),
              message: 'Phoenix unexpectedly accepted the reserved probe Session reference.',
            },
          ],
        }),
        503,
        noStore(),
      )
    } catch (error) {
      if (
        error instanceof PhoenixBrowserSessionError &&
        error.code === AUTH_ERROR.SESSION_REVOKED
      ) {
        return context.json(
          createHealthResponse({
            service: 'auth',
            checks: [
              {
                name: 'phoenix-service-auth',
                status: 'ok',
                latencyMs: Math.round(performance.now() - startedAt),
              },
            ],
          }),
          200,
          noStore(),
        )
      }

      const failure = mapBrowserSessionError(error, AUTH_ERROR.REFRESH_UNAVAILABLE)
      return context.json(
        createHealthResponse({
          service: 'auth',
          status: 'down',
          checks: [
            {
              name: 'phoenix-service-auth',
              status: 'down',
              latencyMs: Math.round(performance.now() - startedAt),
              message: failure.code,
            },
          ],
        }),
        503,
        noStore(),
      )
    }
  })

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
    app.post(AUTH_ROUTE.TEST_LOGIN, async (context) => {
      if (!requireStateChangeOrigin(context)) {
        return context.json({ code: AUTH_ERROR.INVALID_ORIGIN }, 400, noStore())
      }

      return testLogin(context.req.raw)
    })
  }

  app.get(AUTH_ROUTE.SESSION, async (context) => {
    const session = await readSession(context.req.raw)
    return session
      ? new Response(null, { headers: noStore(), status: 204 })
      : Response.json({ code: AUTH_ERROR.SESSION_MISSING }, { headers: noStore(), status: 401 })
  })

  app.post(AUTH_ROUTE.TOKEN_REFRESH, async (context) => {
    if (!requireStateChangeOrigin(context)) {
      return context.json({ code: AUTH_ERROR.INVALID_ORIGIN }, 400, noStore())
    }

    const limiter =
      refreshRateLimiter || context.env?.AUTH_REFRESH_RATE_LIMITER || fallbackRefreshRateLimiter
    const clientLimit = await limiter.limit({
      key: `refresh:client:${clientRateLimitKey(context.req.raw)}`,
    })
    if (!clientLimit.success) {
      return context.json({ code: AUTH_ERROR.RATE_LIMITED }, 429, retryAfter())
    }

    const session = await readSession(context.req.raw)
    if (!session) {
      for (const cookie of buildAuthCookieClearingHeaders(context.req.raw)) {
        context.header('Set-Cookie', cookie, { append: true })
      }
      return context.json({ code: AUTH_ERROR.SESSION_MISSING }, 401, noStore())
    }

    const sessionLimit = await limiter.limit({
      key: `refresh:session:${session.browserSessionRef}`,
    })
    if (!sessionLimit.success) {
      return context.json({ code: AUTH_ERROR.RATE_LIMITED }, 429, retryAfter())
    }

    try {
      const result = await refreshSession(session.browserSessionRef)
      return appendPhoenixTokenCookie(
        new Response(null, { headers: noStore(), status: 204 }),
        result,
      )
    } catch (error) {
      const failure = mapBrowserSessionError(error, AUTH_ERROR.REFRESH_UNAVAILABLE)
      if (clearsBrowserSession(failure.code)) {
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

  app.get(AUTH_ROUTE.SESSIONS, async (context) => {
    const session = await readSession(context.req.raw)
    if (!session) return context.json({ code: AUTH_ERROR.SESSION_MISSING }, 401, noStore())

    try {
      const raw = context.req.query('pagi')
      let pagi: unknown
      try {
        pagi = raw === undefined ? undefined : JSON.parse(raw)
      } catch {
        return context.json({ code: 'PAGI_4209' }, 400, noStore())
      }
      if (pagi !== undefined && !isPagiInput(pagi))
        return context.json({ code: 'PAGI_4209' }, 400, noStore())
      return context.json(await listSessions(session.browserSessionRef, pagi), 200, noStore())
    } catch (error) {
      const failure = mapBrowserSessionError(error, AUTH_ERROR.SESSION_UNAVAILABLE)
      return context.json({ code: failure.code }, failure.status, noStore())
    }
  })

  app.post(AUTH_ROUTE.ACCOUNT_LINK, async (context) => {
    if (!requireStateChangeOrigin(context))
      return context.json({ code: AUTH_ERROR.INVALID_ORIGIN }, 400, noStore())
    if (!(await limitOauth(context.env || {}, `oauth:link:${clientRateLimitKey(context.req.raw)}`)))
      return context.json({ code: AUTH_ERROR.RATE_LIMITED }, 429, retryAfter())
    const provider = context.req.param('provider')
    if (!oauthProvider(provider))
      return context.json({ code: AUTH_ERROR.OAUTH_PROVIDER_UNSUPPORTED }, 400, noStore())
    const session = await readSession(context.req.raw)
    const userToken = readPhoenixUserToken(context.req.raw)
    if (!session || !userToken)
      return context.json({ code: AUTH_ERROR.SESSION_MISSING }, 401, noStore())
    let body: { returnTo?: unknown } = {}
    try {
      body = await context.req.json()
    } catch {
      /* return to the caller origin */
    }
    const intent = createLinkIntent({
      browserSessionRef: session.browserSessionRef,
      provider: provider as TOauthProvider,
      returnTo: safeReturnTo(context.req.raw, body.returnTo),
    })
    try {
      await startLink(userToken, {
        ref: intent.intentRef,
        browserSessionRef: intent.browserSessionRef,
        provider,
        codeVerifier: intent.codeVerifier,
        nonce: intent.nonce,
        returnTo: intent.returnTo,
      })
      const definition = oauthProvider(provider)!
      const redirectUri =
        definition.callback === 'separate'
          ? providerRedirectUri(provider)
          : new URL(`/api/auth/callback/${provider}`, process.env.AUTH_URL).toString()
      const authorizationUrl = definition.authorizationUrl(
        encodeLinkState(intent),
        redirectUri,
        intent.codeVerifier,
      )
      context.header('Set-Cookie', setLinkIntentCookie(intent.intentRef))
      return context.json({ authorizationUrl }, 200, noStore())
    } catch (error) {
      const failure = mapBrowserSessionError(error, AUTH_ERROR.OAUTH_LINK_UNAVAILABLE)
      return context.json({ code: failure.code }, failure.status, noStore())
    }
  })

  const linkCallback = async (
    context: Context<{ Bindings: TBindings }>,
    provider: TOauthProvider,
  ) => {
    const ref = requestCookie(context.req.raw, linkIntentCookie())
    const decoded = decodeLinkState(context.req.query('state') || '')
    const session = await readSession(context.req.raw)
    const userToken = readPhoenixUserToken(context.req.raw)
    if (
      !(await limitOauth(
        context.env || {},
        `oauth:callback:${clientRateLimitKey(context.req.raw)}`,
      ))
    )
      return context.json({ code: AUTH_ERROR.RATE_LIMITED }, 429, retryAfter())
    if (!ref || !decoded || decoded.intentRef !== ref || !session || !userToken) {
      context.header('Cache-Control', 'no-store')
      return context.redirect('/api/auth/error', 303)
    }
    let returnTo: string | undefined
    try {
      const claim = await claimLink(
        userToken,
        ref,
        session.browserSessionRef,
        provider,
        decoded.nonce,
      )
      returnTo = claim.returnTo
      const location = new URL(claim.returnTo)
      const code = context.req.query('code')
      if (!code || context.req.query('error')) {
        await cancelLink(userToken, ref, session.browserSessionRef)
        location.searchParams.set('oauthLink', 'cancelled')
        context.header('Set-Cookie', clearLinkIntentCookie())
        return context.redirect(location.toString(), 303)
      }
      const definition = OAUTH_PROVIDERS[provider]
      const redirectUri =
        definition.callback === 'separate'
          ? providerRedirectUri(provider)
          : new URL(`/api/auth/callback/${provider}`, process.env.AUTH_URL).toString()
      const identity = await (oauthExchanges?.[provider] || definition.exchange)(
        code,
        redirectUri,
        claim.codeVerifier,
      )
      const result = await verifyLink(userToken, ref, session.browserSessionRef, identity)
      location.searchParams.set(
        'oauthLink',
        result.status === 'confirm' ? 'confirm' : 'already_linked',
      )
      if (result.status !== 'confirm') context.header('Set-Cookie', clearLinkIntentCookie())
      context.header('Cache-Control', 'no-store')
      return context.redirect(location.toString(), 303)
    } catch {
      if (returnTo) {
        await cancelLink(userToken, ref, session.browserSessionRef).catch(() => undefined)
        const location = new URL(returnTo)
        location.searchParams.set('oauthLink', 'error')
        context.header('Set-Cookie', clearLinkIntentCookie())
        context.header('Cache-Control', 'no-store')
        return context.redirect(location.toString(), 303)
      }
      context.header('Cache-Control', 'no-store')
      return context.redirect('/api/auth/error', 303)
    }
  }

  app.get(AUTH_ROUTE.ACCOUNT_CALLBACK, (context) => {
    const provider = context.req.param('provider')
    const definition = oauthProvider(provider)
    if (!definition || definition.callback !== 'separate') return context.notFound()
    return linkCallback(context, provider as TOauthProvider)
  })

  app.get('/api/auth/callback/:provider', (context) => {
    const provider = context.req.param('provider')
    const definition = oauthProvider(provider)
    if (!definition) return context.notFound()
    if (definition.callback !== 'shared' || !(context.req.query('state') || '').startsWith('li_'))
      return authHandler(context.req.raw)
    return linkCallback(context, provider as TOauthProvider)
  })

  app.get('/api/auth/accounts/link/confirmation', async (context) => {
    const ref = requestCookie(context.req.raw, linkIntentCookie())
    const session = await readSession(context.req.raw)
    const userToken = readPhoenixUserToken(context.req.raw)
    if (!ref || !session || !userToken)
      return context.json({ code: AUTH_ERROR.SESSION_MISSING }, 401, noStore())
    try {
      const summary = await readLink(userToken, ref, session.browserSessionRef)
      return context.json(
        { provider: summary.provider, providerId: summary.providerId, login: summary.login },
        200,
        noStore(),
      )
    } catch (error) {
      const failure = mapBrowserSessionError(error, AUTH_ERROR.OAUTH_LINK_UNAVAILABLE)
      return context.json({ code: failure.code }, failure.status, noStore())
    }
  })

  app.post('/api/auth/accounts/link/confirmation', async (context) => {
    if (!requireStateChangeOrigin(context))
      return context.json({ code: AUTH_ERROR.INVALID_ORIGIN }, 400, noStore())
    const ref = requestCookie(context.req.raw, linkIntentCookie())
    const session = await readSession(context.req.raw)
    const userToken = readPhoenixUserToken(context.req.raw)
    if (!ref || !session || !userToken)
      return context.json({ code: AUTH_ERROR.SESSION_MISSING }, 401, noStore())
    if (
      !(await limitOauth(context.env || {}, `oauth:confirm:${clientRateLimitKey(context.req.raw)}`))
    )
      return context.json({ code: AUTH_ERROR.RATE_LIMITED }, 429, retryAfter())
    try {
      const body = await context.req.json<{ provider?: unknown; providerId?: unknown }>()
      if (typeof body.provider !== 'string' || typeof body.providerId !== 'string')
        return context.json({ code: AUTH_ERROR.OAUTH_LINK_INVALID_INTENT }, 400, noStore())
      await confirmLink(userToken, ref, session.browserSessionRef, body.provider, body.providerId)
      context.header('Set-Cookie', clearLinkIntentCookie())
      return context.json({ done: true }, 200, noStore())
    } catch (error) {
      const failure = mapBrowserSessionError(error, AUTH_ERROR.OAUTH_LINK_UNAVAILABLE)
      return context.json({ code: failure.code }, failure.status, noStore())
    }
  })

  app.post('/api/auth/accounts/link/cancel', async (context) => {
    if (!requireStateChangeOrigin(context))
      return context.json({ code: AUTH_ERROR.INVALID_ORIGIN }, 400, noStore())
    const ref = requestCookie(context.req.raw, linkIntentCookie())
    const session = await readSession(context.req.raw)
    const userToken = readPhoenixUserToken(context.req.raw)
    if (!ref || !session || !userToken)
      return context.json({ code: AUTH_ERROR.SESSION_MISSING }, 401, noStore())
    try {
      await cancelLink(userToken, ref, session.browserSessionRef)
      context.header('Set-Cookie', clearLinkIntentCookie())
      return context.json({ done: true }, 200, noStore())
    } catch (error) {
      const failure = mapBrowserSessionError(error, AUTH_ERROR.OAUTH_LINK_UNAVAILABLE)
      return context.json({ code: failure.code }, failure.status, noStore())
    }
  })

  app.get(AUTH_ROUTE.ACCOUNTS, async (context) => {
    const session = await readSession(context.req.raw)
    if (!session) return context.json({ code: AUTH_ERROR.SESSION_MISSING }, 401, noStore())

    if (
      !(await limitOauth(
        context.env || {},
        `oauth:accounts:${session.browserSessionRef}:${clientRateLimitKey(context.req.raw)}`,
      ))
    ) {
      return context.json({ code: AUTH_ERROR.RATE_LIMITED }, 429, retryAfter())
    }

    const userToken = readPhoenixUserToken(context.req.raw)
    if (!userToken) return context.json({ code: AUTH_ERROR.TOKEN_MISSING }, 401, noStore())

    try {
      const accounts = await listAccounts(userToken)
      return context.json(
        { accounts } satisfies { accounts: TLinkedOauthAccount[] },
        200,
        noStore(),
      )
    } catch (error) {
      const failure = mapBrowserSessionError(error, AUTH_ERROR.OAUTH_ACCOUNTS_UNAVAILABLE)
      return context.json({ code: failure.code }, failure.status, noStore())
    }
  })

  app.post(AUTH_ROUTE.ACCOUNT_UNLINK, async (context) => {
    if (!requireStateChangeOrigin(context)) {
      return context.json({ code: AUTH_ERROR.INVALID_ORIGIN }, 400, noStore())
    }

    const session = await readSession(context.req.raw)
    if (!session) return context.json({ code: AUTH_ERROR.SESSION_MISSING }, 401, noStore())

    if (
      !(await limitOauth(
        context.env || {},
        `oauth:unlink:${session.browserSessionRef}:${clientRateLimitKey(context.req.raw)}`,
      ))
    ) {
      return context.json({ code: AUTH_ERROR.RATE_LIMITED }, 429, retryAfter())
    }

    const userToken = readPhoenixUserToken(context.req.raw)
    if (!userToken) return context.json({ code: AUTH_ERROR.TOKEN_MISSING }, 401, noStore())

    const publicRef = context.req.param('publicRef')

    const isAmbiguousFailure = (error: unknown): boolean =>
      error instanceof PhoenixBrowserSessionError &&
      (error.code === AUTH_ERROR.PHOENIX_NETWORK_ERROR || (error.upstreamStatus ?? 0) >= 500)

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
      const failure = mapBrowserSessionError(error, AUTH_ERROR.OAUTH_UNLINK_UNAVAILABLE)
      return context.json({ code: failure.code }, failure.status, noStore())
    }
  })

  app.post(AUTH_ROUTE.SESSION_REVOKE_OTHERS, async (context) => {
    if (!requireStateChangeOrigin(context)) {
      return context.json({ code: AUTH_ERROR.INVALID_ORIGIN }, 400, noStore())
    }
    const session = await readSession(context.req.raw)
    if (!session) return context.json({ code: AUTH_ERROR.SESSION_MISSING }, 401, noStore())

    try {
      await revokeOtherSessions(session.browserSessionRef)
      return new Response(null, { headers: noStore(), status: 204 })
    } catch (error) {
      const failure = mapBrowserSessionError(error, AUTH_ERROR.SESSION_UNAVAILABLE)
      return context.json({ code: failure.code }, failure.status, noStore())
    }
  })

  app.post(AUTH_ROUTE.SESSION_REVOKE, async (context) => {
    if (!requireStateChangeOrigin(context)) {
      return context.json({ code: AUTH_ERROR.INVALID_ORIGIN }, 400, noStore())
    }
    const session = await readSession(context.req.raw)
    if (!session) return context.json({ code: AUTH_ERROR.SESSION_MISSING }, 401, noStore())

    try {
      await revokeSessionPublic(session.browserSessionRef, context.req.param('publicRef'))
      return new Response(null, { headers: noStore(), status: 204 })
    } catch (error) {
      const failure = mapBrowserSessionError(error, AUTH_ERROR.SESSION_UNAVAILABLE)
      return context.json({ code: failure.code }, failure.status, noStore())
    }
  })

  app.post(AUTH_ROUTE.LOGOUT, async (context) => {
    if (!requireStateChangeOrigin(context)) {
      return context.json({ code: AUTH_ERROR.INVALID_ORIGIN }, 400, noStore())
    }

    const session = await readSession(context.req.raw)
    if (session) {
      try {
        await revokeSession(session.browserSessionRef)
      } catch (error) {
        const failure = mapBrowserSessionError(error, AUTH_ERROR.LOGOUT_UNAVAILABLE)
        return context.json({ code: failure.code }, failure.status, noStore())
      }
    }

    for (const cookie of buildAuthCookieClearingHeaders(context.req.raw)) {
      context.header('Set-Cookie', cookie, { append: true })
    }
    context.header('Cache-Control', 'no-store')
    return new Response(null, { status: 204 })
  })

  app.get('/api/auth/platforms', async (context) => {
    try {
      return context.json({ providers: await listProviders() }, 200, noStore())
    } catch {
      return context.json({ code: 'OAUTH_PROVIDERS_UNAVAILABLE' }, 503, noStore())
    }
  })

  const registrationCookie = () => `${useSecureCookies ? '__Host-' : ''}groupher-auth.registration`
  const escapeHtml = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (character) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
    )

  app.get('/api/auth/error', (context) => {
    const fallback =
      process.env.NODE_ENV === 'production'
        ? 'https://groupher.com/'
        : 'https://community.groupher.localhost/home/post'
    let target = fallback
    try {
      const cookie = requestCookie(
        context.req.raw,
        getAuthCookieNames(useSecureCookies).callbackUrl,
      )
      if (cookie) {
        const candidate = new URL(decodeURIComponent(cookie))
        if (isAllowedAuthOrigin(candidate.origin) && !candidate.username && !candidate.password) {
          target = candidate.toString()
        }
      }
    } catch {
      // A malformed or missing return address falls back to the product entry.
    }
    context.header('Cache-Control', 'no-store')
    context.header(
      'Content-Security-Policy',
      "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    )
    return context.html(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in failed</title><style>body{font:16px system-ui;max-width:28rem;margin:12vh auto;padding:1rem;line-height:1.5}</style></head><body><main><h1>Sign in failed</h1><p>The authorization could not be completed. Return to the app and try signing in again.</p><a href="${escapeHtml(target)}">Return to Groupher</a></main></body></html>`,
    )
  })

  app.get('/api/auth/register', async (context) => {
    const ref = requestCookie(context.req.raw, registrationCookie())
    if (!ref) return context.json({ code: 'REGISTRATION_EXPIRED' }, 400, noStore())
    if (
      !(await limitOauth(
        context.env || {},
        `oauth:registration:${clientRateLimitKey(context.req.raw)}`,
      ))
    ) {
      return context.json({ code: 'RATE_LIMITED' }, 429, retryAfter())
    }
    try {
      const summary = await readRegistration(ref)
      return context.json(
        { provider: summary.provider, suggestedLogin: summary.suggestedLogin },
        200,
        noStore(),
      )
    } catch {
      return context.json({ code: 'REGISTRATION_EXPIRED' }, 400, noStore())
    }
  })

  app.post('/api/auth/register', async (context) => {
    if (!requireStateChangeOrigin(context))
      return context.json({ code: 'FORBIDDEN' }, 403, noStore())
    const ref = requestCookie(context.req.raw, registrationCookie())
    if (!ref) return context.json({ code: 'REGISTRATION_EXPIRED' }, 400, noStore())
    if (
      !(await limitOauth(
        context.env || {},
        `oauth:registration:${clientRateLimitKey(context.req.raw)}`,
      ))
    ) {
      return context.json({ code: 'RATE_LIMITED' }, 429, retryAfter())
    }
    const body = (await context.req.json().catch(() => null)) as {
      login?: unknown
      action?: unknown
    } | null
    const clearCookie = () =>
      serialize(registrationCookie(), '', {
        httpOnly: true,
        secure: useSecureCookies,
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      })
    if (body?.action === 'cancel') {
      context.header('Set-Cookie', clearCookie())
      return context.json({ done: true }, 200, noStore())
    }
    if (typeof body?.login !== 'string' || !body.login.trim() || body.login.length > 30) {
      return context.json({ code: 'INVALID_LOGIN' }, 400, noStore())
    }
    let session: Awaited<ReturnType<typeof completeRegistration>> | undefined
    try {
      const summary = await readRegistration(ref)
      session = await completeRegistration(ref, body.login, {
        userAgentSummary: context.req.header('user-agent')?.slice(0, 255),
      })
      const response = await signedInResponse(
        session,
        safeReturnTo(context.req.raw, summary.returnTo),
      )
      const headers = new Headers(response.headers)
      headers.delete('location')
      headers.set('content-type', 'application/json')
      headers.append('set-cookie', clearCookie())
      return new Response(JSON.stringify({ done: true }), { status: 200, headers })
    } catch {
      if (session) await revokeSession(session.browserSessionRef).catch(() => undefined)
      return context.json({ code: 'REGISTRATION_FAILED' }, 400, noStore())
    }
  })

  app.on(['GET', 'POST'], AUTH_ROUTE.ROOT, (context) => authHandler(context.req.raw))
  app.on(['GET', 'POST'], AUTH_ROUTE.WILDCARD, (context) => {
    const action = new URL(context.req.url).pathname.slice(AUTH_ROUTE.ROOT.length + 1).split('/')[0]
    if (!AUTH_CORE_ACTIONS.has(action)) return context.notFound()
    return authHandler(context.req.raw)
  })

  return app
}

export default createApp()
