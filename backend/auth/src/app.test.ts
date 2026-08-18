import { afterEach, describe, expect, it, vi } from 'vitest'

import { createApp, mapBrowserSessionError } from './app'
import { PhoenixBrowserSessionError } from './auth'
import { decodeLinkState, MemoryLinkIntentStore } from './link-intent'

describe('Auth Hono application', () => {
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

  it.each([
    ['SESSION_EXPIRED', 401],
    ['SESSION_REVOKED', 401],
    ['ACCOUNT_BLOCKED', 403],
    ['SESSION_CONFLICT', 409],
    ['RATE_LIMITED', 429],
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
        origin: 'https://dashboard.groupher.com',
        'access-control-request-headers': 'content-type, x-auth-return-redirect',
        'access-control-request-method': 'POST',
      },
    })

    expect(response.headers.get('access-control-allow-origin')).toBe(
      'https://dashboard.groupher.com',
    )
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
        origin: 'https://dashboard.groupher.localhost',
        'access-control-request-method': 'GET',
      },
    })

    expect(response.headers.get('access-control-allow-origin')).toBe(
      'https://dashboard.groupher.localhost',
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
        origin: 'https://dashboard.groupher.com:444',
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
        origin: 'https://dashboard.groupher.com',
        'x-groupher-csrf': '1',
      },
    })

    expect(response.status).toBe(204)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('set-cookie')).toContain('groupher-auth.token=phoenix-token')
    await expect(response.text()).resolves.toBe('')
  })

  it('maps a remotely revoked Phoenix Session to login recovery and clears stale cookies', async () => {
    const response = await createApp({
      readBrowserSession: async () => ({
        browserSessionRef: 'bs_revoked',
        sessionAbsoluteExpiresAt: '2026-11-08T00:00:00.000Z',
      }),
      refreshBrowserSession: async () => {
        throw new PhoenixBrowserSessionError('revoked', { code: 'SESSION_REVOKED' })
      },
    }).request('/api/auth/token/refresh', {
      method: 'POST',
      headers: {
        cookie: '__Host-groupher-auth.session-token=stale-session',
        origin: 'https://dashboard.groupher.com',
        'x-groupher-csrf': '1',
      },
    })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ code: 'SESSION_REVOKED' })
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
  })

  it('returns 429 with Retry-After when refresh exceeds its bounded rate limit', async () => {
    const refreshBrowserSession = vi.fn()
    const response = await createApp({
      refreshBrowserSession,
      refreshRateLimiter: { limit: async () => ({ success: false }) },
    }).request('/api/auth/token/refresh', {
      method: 'POST',
      headers: {
        origin: 'https://dashboard.groupher.com',
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
        origin: 'https://dashboard.groupher.com',
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
        origin: 'https://dashboard.groupher.com',
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
        origin: 'https://dashboard.groupher.com',
        'x-groupher-csrf': '1',
      },
      method: 'POST',
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ accounts: [] })
    expect(listLinkedOauthAccounts).toHaveBeenCalledTimes(1)
    expect(unlinkOauthIdentity).toHaveBeenCalledTimes(2)
  })

  it('creates a server-side GitHub link intent and redirects with state and PKCE', async () => {
    vi.stubEnv('AUTH_GITHUB_ID', 'github-client')
    vi.stubEnv('AUTH_URL', 'https://auth.groupher.localhost')
    const store = new MemoryLinkIntentStore()

    const response = await createApp({
      linkIntentStore: store,
      readBrowserSession: async () => ({
        browserSessionRef: 'bs_current',
        sessionAbsoluteExpiresAt: '2026-11-08T00:00:00.000Z',
      }),
    }).request('/api/auth/accounts/github/link', {
      body: JSON.stringify({
        returnTo: 'https://dashboard.groupher.localhost/account/connections',
      }),
      headers: {
        cookie: 'groupher-auth.token=phoenix-user-token',
        'content-type': 'application/json',
        origin: 'https://dashboard.groupher.localhost',
        'x-groupher-csrf': '1',
      },
      method: 'POST',
    })

    expect(response.status).toBe(200)
    const payload = (await response.json()) as { authorizationUrl: string }
    const location = new URL(payload.authorizationUrl)
    expect(location.origin).toBe('https://github.com')
    expect(location.searchParams.get('client_id')).toBe('github-client')
    expect(location.searchParams.get('code_challenge_method')).toBe('S256')
    const state = decodeLinkState(location.searchParams.get('state') || '')
    expect(state).not.toBeNull()
    expect(response.headers.get('set-cookie')).toContain('groupher-auth.link-intent=')
    await expect(store.get(state!.intentRef)).resolves.toMatchObject({
      browserSessionRef: 'bs_current',
      provider: 'github',
      status: 'pending',
    })
  })

  it('consumes the link intent once and links the verified callback identity', async () => {
    vi.stubEnv('AUTH_GITHUB_ID', 'github-client')
    vi.stubEnv('AUTH_URL', 'https://auth.groupher.localhost')
    const store = new MemoryLinkIntentStore()
    const linkOauthIdentity = vi.fn(
      async (userToken: string, identity: Record<string, unknown>) => {
        expect(userToken).toBe('phoenix-user-token')
        expect(identity).toMatchObject({ provider: 'github', providerId: '42', login: 'octocat' })
        return []
      },
    )
    const app = createApp({
      exchangeGithubCodeForIdentity: async () => ({
        login: 'octocat',
        provider: 'github',
        providerId: '42',
      }),
      linkIntentStore: store,
      linkOauthIdentity,
      readBrowserSession: async () => ({
        browserSessionRef: 'bs_current',
        sessionAbsoluteExpiresAt: '2026-11-08T00:00:00.000Z',
      }),
    })

    const begin = await app.request('/api/auth/accounts/github/link', {
      headers: {
        cookie: 'groupher-auth.token=phoenix-user-token',
        origin: 'https://dashboard.groupher.localhost',
        'x-groupher-csrf': '1',
      },
      method: 'POST',
    })
    const beginPayload = (await begin.json()) as { authorizationUrl: string }
    const location = new URL(beginPayload.authorizationUrl)
    const state = location.searchParams.get('state') || ''
    const intent = decodeLinkState(state)
    const cookie = begin.headers.get('set-cookie')?.split(';')[0]

    const callback = await app.request(
      `/api/auth/accounts/github/callback?code=github-code&state=${encodeURIComponent(state)}`,
      { headers: { cookie: `${cookie}; groupher-auth.token=phoenix-user-token` } },
    )

    expect(callback.status).toBe(303)
    expect(new URL(callback.headers.get('location') || '').searchParams.get('oauthLink')).toBe(
      'success',
    )
    expect(linkOauthIdentity).toHaveBeenCalledTimes(1)
    await expect(store.get(intent!.intentRef)).resolves.toMatchObject({ status: 'consumed' })

    const replay = await app.request(
      `/api/auth/accounts/github/callback?code=github-code&state=${encodeURIComponent(state)}`,
      { headers: { cookie: `${cookie}; groupher-auth.token=phoenix-user-token` } },
    )
    expect(replay.status).toBe(303)
    expect(new URL(replay.headers.get('location') || '').searchParams.get('code')).toBe(
      'OAUTH_LINK_REPLAYED',
    )
  })

  it('refreshes an expired Phoenix token once before retrying callback link', async () => {
    vi.stubEnv('AUTH_GITHUB_ID', 'github-client')
    vi.stubEnv('AUTH_URL', 'https://auth.groupher.localhost')
    const store = new MemoryLinkIntentStore()
    let linkAttempts = 0
    const linkOauthIdentity = vi.fn(async () => {
      linkAttempts += 1
      if (linkAttempts === 1) {
        throw new PhoenixBrowserSessionError('Phoenix token expired.', { code: 'TOKEN_EXPIRED' })
      }
      return []
    })
    const refreshedSession = {
      accessExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      accessToken: 'phoenix-refreshed-token',
      browserSessionRef: 'bs_current',
      sessionAbsoluteExpiresAt: '2026-11-08T00:00:00.000Z',
    }
    const refreshBrowserSession = vi.fn(async () => refreshedSession)
    const app = createApp({
      exchangeGithubCodeForIdentity: async () => ({
        login: 'octocat',
        provider: 'github',
        providerId: '42',
      }),
      linkIntentStore: store,
      linkOauthIdentity,
      readBrowserSession: async () => ({
        browserSessionRef: 'bs_current',
        sessionAbsoluteExpiresAt: '2026-11-08T00:00:00.000Z',
      }),
      refreshBrowserSession,
    })

    const begin = await app.request('/api/auth/accounts/github/link', {
      headers: {
        cookie: 'groupher-auth.token=phoenix-user-token',
        origin: 'https://dashboard.groupher.localhost',
        'x-groupher-csrf': '1',
      },
      method: 'POST',
    })
    const beginPayload = (await begin.json()) as { authorizationUrl: string }
    const location = new URL(beginPayload.authorizationUrl)
    const state = location.searchParams.get('state') || ''
    const cookie = begin.headers.get('set-cookie')?.split(';')[0]

    const callback = await app.request(
      `/api/auth/accounts/github/callback?code=github-code&state=${encodeURIComponent(state)}`,
      { headers: { cookie: `${cookie}; groupher-auth.token=phoenix-user-token` } },
    )

    expect(callback.status).toBe(303)
    expect(new URL(callback.headers.get('location') || '').searchParams.get('oauthLink')).toBe(
      'success',
    )
    expect(refreshBrowserSession).toHaveBeenCalledWith('bs_current')
    expect(linkOauthIdentity).toHaveBeenCalledTimes(2)
    expect(callback.headers.get('set-cookie')).toContain(
      'groupher-auth.token=phoenix-refreshed-token',
    )
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
        origin: 'https://dashboard.groupher.com',
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
