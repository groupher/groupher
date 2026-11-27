import {
  AUTH_ERROR,
  GROUPHER_AUTH_CSRF_HEADER,
  GROUPHER_AUTH_CSRF_VALUE,
} from '@groupher/contracts/auth'
import { AUTH_ROUTE } from '@groupher/route-contract'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createApp, isAllowedAuthOrigin, mapBrowserSessionError } from './app'
import { PhoenixBrowserSessionError, useSecureCookies } from './auth'
import { decodeLinkState } from './link-intent'

describe('Auth Hono application', () => {
  it('returns only registration summary and protects completion against cross-origin requests', async () => {
    const summary = {
      provider: 'linuxdo',
      suggestedLogin: 'alice',
      returnTo: 'https://dash.groupher.localhost/home',
    }
    const session = {
      accessToken: 'token',
      accessExpiresAt: '2030-01-01T00:00:00Z',
      browserSessionRef: 'bs-test',
      sessionAbsoluteExpiresAt: '2030-01-02T00:00:00Z',
    }
    const complete = vi.fn(async () => session)
    const app = createApp({
      readOauthRegistration: async () => summary,
      completeOauthRegistration: complete,
      createSignedInResponse: async () =>
        new Response(null, { status: 303, headers: { 'set-cookie': 'session=signed; HttpOnly' } }),
    })
    const cookie = `${useSecureCookies ? '__Host-' : ''}groupher-auth.registration=flow-ref`
    const url = 'https://auth.groupher.localhost/api/auth/register'
    const page = await app.request(url, { headers: { cookie } })
    expect(await page.json()).toEqual({ provider: 'linuxdo', suggestedLogin: 'alice' })
    const submit = (origin: string, csrf: string) =>
      app.request(url, {
        method: 'POST',
        headers: {
          cookie,
          origin,
          [GROUPHER_AUTH_CSRF_HEADER]: csrf,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ login: 'alice' }),
      })
    expect((await submit('https://attacker.example', GROUPHER_AUTH_CSRF_VALUE)).status).toBe(403)
    expect((await submit('https://dash.groupher.localhost', 'bad')).status).toBe(403)
    const result = await submit('https://dash.groupher.localhost', GROUPHER_AUTH_CSRF_VALUE)
    expect(result.status).toBe(200)
    expect(result.headers.get('set-cookie')).toContain('session=signed')
    expect(result.headers.get('set-cookie')).toContain('Max-Age=0')
    expect(complete).toHaveBeenCalledOnce()
  })

  it('allows retry after a failed username and cancels without creating an account', async () => {
    const complete = vi.fn().mockRejectedValueOnce(new Error('taken'))
    const app = createApp({
      readOauthRegistration: async () => ({
        provider: 'linuxdo',
        suggestedLogin: 'alice',
        returnTo: 'https://dash.groupher.localhost/home',
      }),
      completeOauthRegistration: complete,
    })
    const cookie = `${useSecureCookies ? '__Host-' : ''}groupher-auth.registration=flow-ref`
    const submit = (body: object) =>
      app.request('https://auth.groupher.localhost/api/auth/register', {
        method: 'POST',
        headers: {
          cookie,
          origin: 'https://dash.groupher.localhost',
          [GROUPHER_AUTH_CSRF_HEADER]: GROUPHER_AUTH_CSRF_VALUE,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      })
    expect((await submit({ login: 'taken' })).status).toBe(400)
    const cancelled = await submit({ action: 'cancel' })
    expect(cancelled.status).toBe(200)
    expect(cancelled.headers.get('set-cookie')).toContain('Max-Age=0')
    expect(complete).toHaveBeenCalledTimes(1)
  })

  it('revokes the browser session if signing the registration cookies fails', async () => {
    const revoke = vi.fn(async () => undefined)
    const app = createApp({
      readOauthRegistration: async () => ({
        provider: 'linuxdo',
        suggestedLogin: 'alice',
        returnTo: 'https://dash.groupher.localhost/home',
      }),
      completeOauthRegistration: async () => ({
        accessToken: 'token',
        accessExpiresAt: '2030-01-01T00:00:00Z',
        browserSessionRef: 'bs-test',
        sessionAbsoluteExpiresAt: '2030-01-02T00:00:00Z',
      }),
      createSignedInResponse: async () => {
        throw new Error('signing failed')
      },
      revokeBrowserSession: revoke,
    })
    const response = await app.request('https://auth.groupher.localhost/api/auth/register', {
      method: 'POST',
      headers: {
        cookie: `${useSecureCookies ? '__Host-' : ''}groupher-auth.registration=flow-ref`,
        origin: 'https://dash.groupher.localhost',
        [GROUPHER_AUTH_CSRF_HEADER]: GROUPHER_AUTH_CSRF_VALUE,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ login: 'alice' }),
    })
    expect(response.status).toBe(400)
    expect(revoke).toHaveBeenCalledWith('bs-test')
  })

  it('keeps local login routes unregistered unless the Node server injects local handlers', async () => {
    vi.stubEnv('LOCAL_TEST_ACTORS_SECRET', 'stale-flag-must-not-register-a-route')
    const headers = {
      origin: 'https://dash.groupher.localhost',
      [GROUPHER_AUTH_CSRF_HEADER]: GROUPHER_AUTH_CSRF_VALUE,
    }

    const ordinary = await createApp().request(AUTH_ROUTE.TEST_LOGIN, { method: 'POST', headers })
    const admin = await createApp().request('/api/auth/test-admin-login', {
      method: 'POST',
      headers,
    })
    expect(ordinary.status).toBe(404)
    expect(admin.status).toBe(404)
  })

  it('registers injected local login routes behind the existing Origin and CSRF guard', async () => {
    const testLogin = vi.fn(async () => new Response(null, { status: 204 }))
    const app = createApp({ testLogin })

    const ordinary = await app.request(AUTH_ROUTE.TEST_LOGIN, {
      method: 'POST',
      headers: {
        origin: 'https://dash.groupher.localhost',
        [GROUPHER_AUTH_CSRF_HEADER]: GROUPHER_AUTH_CSRF_VALUE,
      },
    })
    const admin = await app.request('/api/auth/test-admin-login', {
      method: 'POST',
      headers: {
        origin: 'https://dash.groupher.localhost',
        [GROUPHER_AUTH_CSRF_HEADER]: GROUPHER_AUTH_CSRF_VALUE,
      },
    })
    const invalidOrigin = await app.request(AUTH_ROUTE.TEST_LOGIN, {
      method: 'POST',
      headers: {
        origin: 'https://attacker.example',
        [GROUPHER_AUTH_CSRF_HEADER]: GROUPHER_AUTH_CSRF_VALUE,
      },
    })

    expect(ordinary.status).toBe(204)
    expect(admin.status).toBe(404)
    expect(invalidOrigin.status).toBe(400)
    expect(testLogin).toHaveBeenCalledOnce()
  })

  it.each(['/api/auth/production-seed/redeem', '/api/auth/unknown'])(
    'rejects removed or unknown action %s even with stale flags',
    async (path) => {
      vi.stubEnv('PRODUCTION_SEED_LOGIN_ENABLED', 'true')
      vi.stubEnv('PRODUCTION_SEED_LOGIN_UNTIL', '2099-01-01T00:00:00Z')
      const authHandler = vi.fn(async () => new Response(null, { status: 204 }))
      const response = await createApp({ authHandler }).request(path, { method: 'POST' })
      expect(response.status).toBe(404)
      expect(response.headers.has('set-cookie')).toBe(false)
      expect(authHandler).not.toHaveBeenCalled()
    },
  )

  it.each([
    'providers',
    'csrf',
    'signin/github',
    'callback/github',
    'signout',
    'verify-request',
    'webauthn-options',
  ])('keeps the official Auth action %s delegated', async (action) => {
    const authHandler = vi.fn(async () => new Response(null, { status: 204 }))
    const response = await createApp({ authHandler }).request(`/api/auth/${action}`)
    expect(response.status).toBe(204)
    expect(authHandler).toHaveBeenCalledOnce()
  })

  it('shows a retry page when an OAuth login cannot be completed', async () => {
    const authHandler = vi.fn(async () => new Response(null, { status: 204 }))
    const response = await createApp({ authHandler }).request('/api/auth/error?error=Configuration')
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('try signing in again')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(authHandler).not.toHaveBeenCalled()
  })

  it('keeps the OAuth error fallback within the managed development environment', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('DEV_HUB_MANAGED_ENVIRONMENT', 'true')
    vi.stubEnv('DEV_HUB_PUBLIC_ROOT', 'groupher-feature-login.localhost')
    vi.stubEnv('AUTH_TEST_ALLOWED_ORIGINS', '')
    expect(isAllowedAuthOrigin('https://dash.groupher-feature-login.localhost')).toBe(true)
    expect(isAllowedAuthOrigin('https://dash.groupher.localhost')).toBe(false)
    const response = await createApp().request('/api/auth/error')
    expect(await response.text()).toContain(
      'https://community.groupher-feature-login.localhost/home/post',
    )

    vi.stubEnv('NODE_ENV', 'production')
    const production = await createApp().request('/api/auth/error')
    expect(await production.text()).toContain('https://groupher.com/')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('exposes the service health contract', async () => {
    const response = await createApp().request('/health')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      schemaVersion: 'health.v1',
      status: 'ok',
      service: 'auth',
      version: expect.any(String),
      environment: expect.any(String),
      timestamp: expect.any(String),
      uptimeMs: expect.any(Number),
      checks: [],
    })
  })

  it('keeps the service Auth contract probe disabled outside Dev Hub', async () => {
    const response = await createApp().request('/health/service-auth')

    expect(response.status).toBe(404)
  })

  it('accepts SESSION_REVOKED as proof that the service Auth contract reached Phoenix', async () => {
    vi.stubEnv('DEV_HUB_SERVICE_AUTH_PROBE', 'true')
    const refreshBrowserSession = vi.fn(async () => {
      throw new PhoenixBrowserSessionError('Reserved probe Session does not exist.', {
        code: AUTH_ERROR.SESSION_REVOKED,
      })
    })

    const response = await createApp({ refreshBrowserSession }).request('/health/service-auth')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      status: 'ok',
      service: 'auth',
      checks: [{ name: 'phoenix-service-auth', status: 'ok' }],
    })
    expect(refreshBrowserSession).toHaveBeenCalledWith('dev-hub-service-auth-contract-probe')
  })

  it('reports the service Auth machine code when the startup contract fails', async () => {
    vi.stubEnv('DEV_HUB_SERVICE_AUTH_PROBE', 'true')
    const refreshBrowserSession = vi.fn(async () => {
      throw new PhoenixBrowserSessionError('Service token claims are invalid.', {
        code: AUTH_ERROR.SERVICE_TOKEN_INVALID,
      })
    })

    const response = await createApp({ refreshBrowserSession }).request('/health/service-auth')

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      status: 'down',
      checks: [
        {
          name: 'phoenix-service-auth',
          status: 'down',
          message: AUTH_ERROR.SERVICE_TOKEN_INVALID,
        },
      ],
    })
  })

  it.each([
    [AUTH_ERROR.SESSION_EXPIRED, 401],
    [AUTH_ERROR.SESSION_REVOKED, 401],
    [AUTH_ERROR.ACCOUNT_BLOCKED, 403],
    [AUTH_ERROR.SESSION_CONFLICT, 409],
    [AUTH_ERROR.RATE_LIMITED, 429],
    [AUTH_ERROR.SERVICE_TOKEN_INVALID, 401],
    [AUTH_ERROR.SERVICE_SCOPE_FORBIDDEN, 403],
    [AUTH_ERROR.SERVICE_JWKS_UNAVAILABLE, 503],
  ] as const)('maps Phoenix %s to HTTP %i', (code, status) => {
    expect(
      mapBrowserSessionError(new PhoenixBrowserSessionError(code, { code }), 'fallback'),
    ).toEqual({ code, status })
  })

  it('forwards Auth.js protocol requests to the core handler', async () => {
    const authHandler = vi.fn(async (_request: Request) => Response.json({ providers: ['github'] }))
    const app = createApp({ authHandler })

    const response = await app.request('/api/auth/providers')

    expect(response.status).toBe(200)
    expect(authHandler).toHaveBeenCalledTimes(1)
    const forwardedRequest = authHandler.mock.calls[0]?.[0]
    expect(forwardedRequest && new URL(forwardedRequest.url).pathname).toBe('/api/auth/providers')
  })

  it('applies Auth CORS to the Auth.js base path', async () => {
    const response = await createApp().request('/api/auth', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://dash.groupher.com',
        'access-control-request-headers': 'content-type, x-auth-return-redirect',
        'access-control-request-method': 'POST',
      },
    })

    expect(response.headers.get('access-control-allow-origin')).toBe('https://dash.groupher.com')
    expect(response.headers.get('access-control-allow-credentials')).toBe('true')
    expect(response.headers.get('access-control-allow-headers')).toContain('x-auth-return-redirect')
    expect(response.headers.get('access-control-expose-headers')).toContain('Retry-After')
  })

  it('rejects credentialed Auth CORS from community subdomains', async () => {
    const response = await createApp().request('/api/auth/session', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://home.groupher.com',
        'access-control-request-method': 'GET',
      },
    })

    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('allows local development Auth CORS origins', async () => {
    const response = await createApp().request('/api/auth/session', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://dash.groupher.localhost',
        'access-control-request-method': 'GET',
      },
    })

    expect(response.headers.get('access-control-allow-origin')).toBe(
      'https://dash.groupher.localhost',
    )
  })

  it('allows the Community application Auth CORS origins', async () => {
    const localResponse = await createApp().request('/api/auth/session', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://community.groupher.localhost',
        'access-control-request-method': 'GET',
      },
    })
    const productionResponse = await createApp().request('/api/auth/session', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://community.groupher.com',
        'access-control-request-method': 'GET',
      },
    })

    expect(localResponse.headers.get('access-control-allow-origin')).toBe(
      'https://community.groupher.localhost',
    )
    expect(productionResponse.headers.get('access-control-allow-origin')).toBe(
      'https://community.groupher.com',
    )
  })

  it('allows explicitly configured test origins with ports outside production', async () => {
    vi.stubEnv('AUTH_TEST_ALLOWED_ORIGINS', 'http://dash.groupher.localhost:3103')

    const response = await createApp().request('/api/auth/session', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://dash.groupher.localhost:3103',
        'access-control-request-method': 'GET',
      },
    })

    expect(response.headers.get('access-control-allow-origin')).toBe(
      'http://dash.groupher.localhost:3103',
    )
  })

  it('rejects local Auth CORS origins in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('AUTH_TEST_ALLOWED_ORIGINS', 'http://dash.groupher.localhost:3103')

    const response = await createApp().request('/api/auth/session', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://dash.groupher.localhost:3103',
        'access-control-request-method': 'GET',
      },
    })

    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('rejects first-party Auth CORS origins on non-default HTTPS ports', async () => {
    const response = await createApp().request('/api/auth/session', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://dash.groupher.com:444',
        'access-control-request-method': 'GET',
      },
    })

    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('rejects state-changing Auth requests without the Origin and custom CSRF proof', async () => {
    const refreshBrowserSession = vi.fn()
    const response = await createApp({ refreshBrowserSession }).request('/api/auth/token/refresh', {
      method: 'POST',
    })

    expect(response.status).toBe(400)
    expect(refreshBrowserSession).not.toHaveBeenCalled()
  })

  it('refreshes a valid Auth Browser Session without exposing the Phoenix credential', async () => {
    const response = await createApp({
      readBrowserSession: async () => ({
        browserSessionRef: 'bs_current',
        sessionAbsoluteExpiresAt: '2026-11-08T00:00:00.000Z',
      }),
      refreshBrowserSession: async () => ({
        accessExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        accessToken: 'phoenix-token',
        browserSessionRef: 'bs_current',
        sessionAbsoluteExpiresAt: '2026-11-08T00:00:00.000Z',
      }),
    }).request('/api/auth/token/refresh', {
      method: 'POST',
      headers: {
        origin: 'https://dash.groupher.com',
        'x-groupher-csrf': '1',
      },
    })

    expect(response.status).toBe(204)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('set-cookie')).toContain('groupher-auth.token=phoenix-token')
    await expect(response.text()).resolves.toBe('')
  })

  it('clears stale browser cookies when refresh has no Browser Session', async () => {
    const response = await createApp({ readBrowserSession: async () => null }).request(
      '/api/auth/token/refresh',
      {
        method: 'POST',
        headers: {
          cookie: 'groupher-auth.signed-in=1; groupher-auth.token=stale-token',
          origin: 'https://community.groupher.localhost',
          'x-groupher-csrf': '1',
        },
      },
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ code: AUTH_ERROR.SESSION_MISSING })
    expect(response.headers.get('set-cookie')).toContain('groupher-auth.signed-in=')
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
  })

  it('maps a remotely revoked Phoenix Session to login recovery and clears stale cookies', async () => {
    const response = await createApp({
      readBrowserSession: async () => ({
        browserSessionRef: 'bs_revoked',
        sessionAbsoluteExpiresAt: '2026-11-08T00:00:00.000Z',
      }),
      refreshBrowserSession: async () => {
        throw new PhoenixBrowserSessionError('revoked', { code: AUTH_ERROR.SESSION_REVOKED })
      },
    }).request('/api/auth/token/refresh', {
      method: 'POST',
      headers: {
        cookie: '__Host-groupher-auth.session-token=stale-session',
        origin: 'https://dash.groupher.com',
        'x-groupher-csrf': '1',
      },
    })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ code: AUTH_ERROR.SESSION_REVOKED })
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
  })

  it.each([
    [AUTH_ERROR.SERVICE_TOKEN_INVALID, 401],
    [AUTH_ERROR.SERVICE_SCOPE_FORBIDDEN, 403],
    [AUTH_ERROR.SERVICE_JWKS_UNAVAILABLE, 503],
  ] as const)('preserves %s without clearing the Browser Session', async (code, status) => {
    const response = await createApp({
      readBrowserSession: async () => ({
        browserSessionRef: 'bs_current',
        sessionAbsoluteExpiresAt: '2026-11-08T00:00:00.000Z',
      }),
      refreshBrowserSession: async () => {
        throw new PhoenixBrowserSessionError(code, { code })
      },
    }).request('/api/auth/token/refresh', {
      method: 'POST',
      headers: {
        cookie: '__Host-groupher-auth.session-token=current-session',
        origin: 'https://dash.groupher.com',
        'x-groupher-csrf': '1',
      },
    })

    expect(response.status).toBe(status)
    await expect(response.json()).resolves.toEqual({ code })
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('returns 429 with Retry-After when refresh exceeds its bounded rate limit', async () => {
    const refreshBrowserSession = vi.fn()
    const response = await createApp({
      refreshBrowserSession,
      refreshRateLimiter: { limit: async () => ({ success: false }) },
    }).request('/api/auth/token/refresh', {
      method: 'POST',
      headers: {
        origin: 'https://dash.groupher.com',
        'x-groupher-csrf': '1',
      },
    })

    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('60')
    await expect(response.json()).resolves.toEqual({ code: 'RATE_LIMITED' })
    expect(refreshBrowserSession).not.toHaveBeenCalled()
  })

  it('lists linked OAuth accounts through the delegated Phoenix contract', async () => {
    const listLinkedOauthAccounts = vi.fn(async (userToken: string) => {
      expect(userToken).toBe('phoenix-user-token')
      return [
        {
          publicRef: 'oauth_ref',
          provider: 'github',
          login: 'octocat',
          nickname: 'Octocat',
          avatar: null,
          canUnlink: false,
          linkedAt: '2026-08-11T00:00:00.000Z',
        },
      ]
    })

    const response = await createApp({
      readBrowserSession: async () => ({
        browserSessionRef: 'bs_current',
        sessionAbsoluteExpiresAt: '2026-11-08T00:00:00.000Z',
      }),
      listLinkedOauthAccounts,
    }).request('/api/auth/accounts', {
      headers: { cookie: 'groupher-auth.token=phoenix-user-token' },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      accounts: [{ publicRef: 'oauth_ref', provider: 'github', canUnlink: false }],
    })
  })

  it('unlinks a linked OAuth account with Origin and CSRF proof', async () => {
    const unlinkOauthIdentity = vi.fn(async (userToken: string, publicRef: string) => {
      expect(userToken).toBe('phoenix-user-token')
      expect(publicRef).toBe('oauth_ref')
      return []
    })

    const response = await createApp({
      readBrowserSession: async () => ({
        browserSessionRef: 'bs_current',
        sessionAbsoluteExpiresAt: '2026-11-08T00:00:00.000Z',
      }),
      unlinkOauthIdentity,
    }).request('/api/auth/accounts/oauth_ref/unlink', {
      headers: {
        cookie: 'groupher-auth.token=phoenix-user-token',
        origin: 'https://dash.groupher.com',
        'x-groupher-csrf': '1',
      },
      method: 'POST',
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ accounts: [] })
    expect(unlinkOauthIdentity).toHaveBeenCalledTimes(1)
  })

  it('reconciles an ambiguous unlink failure by refetching the account list', async () => {
    const unlinkOauthIdentity = vi.fn(async () => {
      throw new PhoenixBrowserSessionError('Phoenix request was not completed.', {
        code: 'PHOENIX_NETWORK_ERROR',
      })
    })
    const listLinkedOauthAccounts = vi.fn(async () => [])

    const response = await createApp({
      listLinkedOauthAccounts,
      readBrowserSession: async () => ({
        browserSessionRef: 'bs_current',
        sessionAbsoluteExpiresAt: '2026-11-08T00:00:00.000Z',
      }),
      unlinkOauthIdentity,
    }).request('/api/auth/accounts/oauth_ref/unlink', {
      headers: {
        cookie: 'groupher-auth.token=phoenix-user-token',
        origin: 'https://dash.groupher.com',
        'x-groupher-csrf': '1',
      },
      method: 'POST',
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ accounts: [] })
    expect(listLinkedOauthAccounts).toHaveBeenCalledTimes(1)
    expect(unlinkOauthIdentity).toHaveBeenCalledTimes(1)
  })

  it('retries unlink once when reconciliation still finds the binding', async () => {
    let attempts = 0
    const unlinkOauthIdentity = vi.fn(async () => {
      attempts += 1
      if (attempts === 1) {
        throw new PhoenixBrowserSessionError('Phoenix request was not completed.', {
          code: 'PHOENIX_NETWORK_ERROR',
        })
      }
      return []
    })
    const listLinkedOauthAccounts = vi.fn(async () => [
      {
        avatar: null,
        canUnlink: true,
        linkedAt: '2026-08-11T00:00:00.000Z',
        login: 'octocat',
        nickname: 'Octocat',
        provider: 'github',
        publicRef: 'oauth_ref',
      },
    ])

    const response = await createApp({
      listLinkedOauthAccounts,
      readBrowserSession: async () => ({
        browserSessionRef: 'bs_current',
        sessionAbsoluteExpiresAt: '2026-11-08T00:00:00.000Z',
      }),
      unlinkOauthIdentity,
    }).request('/api/auth/accounts/oauth_ref/unlink', {
      headers: {
        cookie: 'groupher-auth.token=phoenix-user-token',
        origin: 'https://dash.groupher.com',
        'x-groupher-csrf': '1',
      },
      method: 'POST',
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ accounts: [] })
    expect(listLinkedOauthAccounts).toHaveBeenCalledTimes(1)
    expect(unlinkOauthIdentity).toHaveBeenCalledTimes(2)
  })

  it('rejects an unregistered provider before starting or processing a link', async () => {
    const start = vi.fn()
    const app = createApp({ startOauthLink: start })
    const startResponse = await app.request('/api/auth/accounts/unknown/link', {
      method: 'POST',
      headers: {
        origin: 'https://dash.groupher.localhost',
        [GROUPHER_AUTH_CSRF_HEADER]: GROUPHER_AUTH_CSRF_VALUE,
      },
    })
    expect(startResponse.status).toBe(400)
    expect(start).not.toHaveBeenCalled()
    expect((await app.request('/api/auth/accounts/unknown/callback')).status).toBe(404)
    expect((await app.request('/api/auth/callback/unknown')).status).toBe(404)
  })

  it('claims a GitHub callback once and requires explicit confirmation', async () => {
    vi.stubEnv('AUTH_GITHUB_ID', 'github-client')
    vi.stubEnv('AUTH_URL', 'https://auth.groupher.localhost')
    const startOauthLink = vi.fn(async () => undefined)
    const claimOauthLink = vi.fn(async () => ({
      codeVerifier: 'verifier',
      returnTo: 'https://dash.groupher.localhost/account/connections',
    }))
    const verifyOauthLink = vi.fn(async () => ({
      status: 'confirm',
      returnTo: 'https://dash.groupher.localhost/account/connections',
    }))
    const confirmOauthLink = vi.fn(async () => ({
      returnTo: 'https://dash.groupher.localhost/account/connections',
    }))
    const app = createApp({
      startOauthLink,
      claimOauthLink,
      verifyOauthLink,
      confirmOauthLink,
      readOauthLink: async () => ({
        provider: 'github',
        providerId: '42',
        login: 'octocat',
        returnTo: 'https://dash.groupher.localhost/account/connections',
      }),
      oauthExchanges: {
        github: async () => ({
          provider: 'github',
          providerId: '42',
          login: 'octocat',
        }),
      },
      readBrowserSession: async () => ({
        browserSessionRef: 'bs_current',
        sessionAbsoluteExpiresAt: '2030-01-01T00:00:00Z',
      }),
    })
    const headers = {
      cookie: 'groupher-auth.token=phoenix-user-token',
      origin: 'https://dash.groupher.localhost',
      'x-groupher-csrf': '1',
    }
    const begin = await app.request('/api/auth/accounts/github/link', { method: 'POST', headers })
    expect(begin.status).toBe(200)
    const location = new URL(
      ((await begin.json()) as { authorizationUrl: string }).authorizationUrl,
    )
    expect(location.searchParams.get('code_challenge_method')).toBe('S256')
    const state = location.searchParams.get('state') || ''
    expect(decodeLinkState(state)).not.toBeNull()
    const cookie = `${begin.headers.get('set-cookie')!.split(';')[0]}; ${headers.cookie}`
    const callback = await app.request(
      `/api/auth/accounts/github/callback?code=test&state=${encodeURIComponent(state)}`,
      { headers: { cookie } },
    )
    expect(callback.status).toBe(303)
    expect(new URL(callback.headers.get('location')!).searchParams.get('oauthLink')).toBe('confirm')
    expect(callback.headers.get('set-cookie')).toBeNull()
    expect(claimOauthLink).toHaveBeenCalledOnce()
    expect(verifyOauthLink).toHaveBeenCalledOnce()
    expect(confirmOauthLink).not.toHaveBeenCalled()
    const confirmation = await app.request('/api/auth/accounts/link/confirmation', {
      headers: { cookie },
    })
    expect(await confirmation.json()).toEqual({
      provider: 'github',
      providerId: '42',
      login: 'octocat',
    })
    const result = await app.request('/api/auth/accounts/link/confirmation', {
      method: 'POST',
      headers: { ...headers, cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'github', providerId: '42' }),
    })
    expect(result.status).toBe(200)
    expect(confirmOauthLink).toHaveBeenCalledOnce()
  })

  it('offers a retry when a link callback no longer has its initiating session', async () => {
    const app = createApp({ readBrowserSession: async () => null })
    const response = await app.request('/api/auth/accounts/github/callback?state=invalid&code=test')
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/api/auth/error')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('cancels a failed exchange and returns to the account page', async () => {
    vi.stubEnv('AUTH_GITHUB_ID', 'github-client')
    vi.stubEnv('AUTH_URL', 'https://auth.groupher.localhost')
    const cancelOauthLink = vi.fn(async () => undefined)
    const app = createApp({
      startOauthLink: async () => undefined,
      claimOauthLink: async () => ({
        codeVerifier: 'wrong',
        returnTo: 'https://dash.groupher.localhost/',
      }),
      cancelOauthLink,
      oauthExchanges: {
        github: async () => {
          throw new Error('exchange failed')
        },
      },
      readBrowserSession: async () => ({
        browserSessionRef: 'bs_current',
        sessionAbsoluteExpiresAt: '2030-01-01T00:00:00Z',
      }),
    })
    const headers = {
      cookie: 'groupher-auth.token=phoenix-user-token',
      origin: 'https://dash.groupher.localhost',
      'x-groupher-csrf': '1',
    }
    const begin = await app.request('/api/auth/accounts/github/link', { method: 'POST', headers })
    const url = new URL(((await begin.json()) as { authorizationUrl: string }).authorizationUrl)
    const cookie = `${begin.headers.get('set-cookie')!.split(';')[0]}; ${headers.cookie}`
    const response = await app.request(
      `/api/auth/accounts/github/callback?code=test&state=${encodeURIComponent(url.searchParams.get('state')!)}`,
      { headers: { cookie } },
    )
    expect(response.status).toBe(303)
    expect(new URL(response.headers.get('location')!).searchParams.get('oauthLink')).toBe('error')
    expect(cancelOauthLink).toHaveBeenCalledOnce()
    expect(response.headers.get('set-cookie')).not.toContain('groupher-auth.token')
  })

  it('shares the Linux DO callback without routing a regular sign-in into linking', async () => {
    vi.stubEnv('AUTH_LINUXDO_ID', 'linuxdo-client')
    vi.stubEnv('AUTH_URL', 'https://auth.groupher.localhost')
    const authHandler = vi.fn(async () => new Response('normal login'))
    const claimOauthLink = vi.fn(async () => ({
      codeVerifier: 'verifier',
      returnTo: 'https://dash.groupher.localhost/home',
    }))
    const exchangeLinuxDoCodeForIdentity = vi.fn(async () => ({
      provider: 'linuxdo',
      providerId: '42',
      login: 'alice',
      nickname: undefined,
      avatar: undefined,
    }))
    const app = createApp({
      authHandler,
      startOauthLink: async () => undefined,
      claimOauthLink,
      verifyOauthLink: async () => ({
        status: 'confirm',
        returnTo: 'https://dash.groupher.localhost/home',
      }),
      oauthExchanges: { linuxdo: exchangeLinuxDoCodeForIdentity },
      readBrowserSession: async () => ({
        browserSessionRef: 'bs_current',
        sessionAbsoluteExpiresAt: '2030-01-01T00:00:00Z',
      }),
    })
    const headers = {
      cookie: 'groupher-auth.token=phoenix-user-token',
      origin: 'https://dash.groupher.localhost',
      'x-groupher-csrf': '1',
    }
    const begin = await app.request('/api/auth/accounts/linuxdo/link', { method: 'POST', headers })
    const authorization = new URL(
      ((await begin.json()) as { authorizationUrl: string }).authorizationUrl,
    )
    expect(authorization.searchParams.get('redirect_uri')).toBe(
      'https://auth.groupher.localhost/api/auth/callback/linuxdo',
    )
    expect(authorization.searchParams.get('code_challenge_method')).toBe('S256')
    const cookie = `${begin.headers.get('set-cookie')!.split(';')[0]}; ${headers.cookie}`
    const ordinary = await app.request(
      '/api/auth/callback/linuxdo?state=ordinary-state&code=normal',
      { headers: { cookie } },
    )
    expect(await ordinary.text()).toBe('normal login')
    expect(claimOauthLink).not.toHaveBeenCalled()
    const state = authorization.searchParams.get('state')!
    const linked = await app.request(
      `/api/auth/callback/linuxdo?state=${encodeURIComponent(state)}&code=link`,
      { headers: { cookie } },
    )
    expect(linked.status).toBe(303)
    expect(claimOauthLink).toHaveBeenCalledOnce()
    expect(exchangeLinuxDoCodeForIdentity).toHaveBeenCalledWith(
      'link',
      'https://auth.groupher.localhost/api/auth/callback/linuxdo',
      'verifier',
    )
    expect(linked.headers.get('set-cookie')).toBeNull()
    const ordinaryAfterLink = await app.request(
      '/api/auth/callback/linuxdo?state=another-ordinary-state&code=normal',
      { headers: { cookie } },
    )
    expect(await ordinaryAfterLink.text()).toBe('normal login')
    expect(claimOauthLink).toHaveBeenCalledOnce()
  })

  it('rate limits OAuth account operations', async () => {
    const response = await createApp({
      oauthRateLimiter: { limit: async () => ({ success: false }) },
      readBrowserSession: async () => ({
        browserSessionRef: 'bs_current',
        sessionAbsoluteExpiresAt: '2026-11-08T00:00:00.000Z',
      }),
    }).request('/api/auth/accounts', {
      headers: { cookie: 'groupher-auth.token=phoenix-user-token' },
    })

    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('60')
    await expect(response.json()).resolves.toEqual({ code: 'RATE_LIMITED' })
  })

  it('rate limits service-token issuance before credential processing', async () => {
    const issueRequest = new Request('https://auth.test/oauth2/token', {
      body: 'grant_type=client_credentials',
      headers: {
        authorization: 'Basic Y2xpZW50OnNlY3JldA==',
        'content-type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
    })
    const response = await createApp({
      serviceTokenRateLimiter: { limit: async () => ({ success: false }) },
    }).request(issueRequest)

    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('60')
    await expect(response.json()).resolves.toEqual({
      error: 'slow_down',
      error_description: 'Too many token requests.',
    })
  })

  it('clears Phoenix and Auth cookies through the custom logout endpoint', async () => {
    const revokeBrowserSession = vi.fn(async () => undefined)
    const response = await createApp({
      readBrowserSession: async () => ({
        browserSessionRef: 'bs_current',
        sessionAbsoluteExpiresAt: '2026-11-08T00:00:00.000Z',
      }),
      revokeBrowserSession,
    }).request('/api/auth/logout', {
      method: 'POST',
      headers: {
        origin: 'https://dash.groupher.com',
        'x-groupher-csrf': '1',
        cookie: [
          'groupher-auth.token=phoenix-token',
          '__Host-groupher-auth.session-token.0=session-a',
          '__Host-groupher-auth.session-token.1=session-b',
          '__Host-groupher-auth.csrf-token=csrf',
        ].join('; '),
      },
    })
    const cookie = response.headers.get('set-cookie') || ''

    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(cookie).toContain('groupher-auth.token=')
    expect(cookie).toContain('__Host-groupher-auth.session-token=')
    expect(cookie).toContain('__Host-groupher-auth.session-token.0=')
    expect(cookie).toContain('__Host-groupher-auth.session-token.1=')
    expect(cookie).toContain('__Host-groupher-auth.csrf-token=')
    expect(cookie).toContain('Max-Age=0')
    expect(revokeBrowserSession).toHaveBeenCalledWith('bs_current')
  })
})

it('passes canonical session pagination through Auth and rejects a second input grammar', async () => {
  const page = {
    entries: [],
    pageInfo: {
      __typename: 'OffsetPageInfo' as const,
      page: 2,
      size: 10,
      totalCount: 11,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true,
    },
  }
  const listBrowserSessions = vi.fn(async () => page)
  const app = createApp({
    readBrowserSession: async () => ({
      browserSessionRef: 'bs_current',
      sessionAbsoluteExpiresAt: '2026-11-08T00:00:00.000Z',
    }),
    listBrowserSessions,
  })
  const pagi = { offset: { page: 2, size: 10 } }
  const response = await app.request(
    `/api/auth/sessions?pagi=${encodeURIComponent(JSON.stringify(pagi))}`,
  )
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual(page)
  expect(listBrowserSessions).toHaveBeenCalledWith('bs_current', pagi)
  const invalid = await app.request(
    `/api/auth/sessions?pagi=${encodeURIComponent(JSON.stringify({ page: 2 }))}`,
  )
  expect(invalid.status).toBe(400)
  expect(listBrowserSessions).toHaveBeenCalledTimes(1)
  expect(
    mapBrowserSessionError(
      new PhoenixBrowserSessionError('cursor mismatch', { code: 'PAGI_4203' }),
      AUTH_ERROR.SESSION_UNAVAILABLE,
    ).status,
  ).toBe(400)
})
