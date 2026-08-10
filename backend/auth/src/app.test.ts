import { afterEach, describe, expect, it, vi } from 'vitest'

import { createApp, mapBrowserSessionError } from './app'
import { PhoenixBrowserSessionError } from './auth'

const originalNodeEnv = process.env.NODE_ENV
const originalTestAllowedOrigins = process.env.AUTH_TEST_ALLOWED_ORIGINS

describe('Auth Hono application', () => {
  afterEach(() => {
    if (originalTestAllowedOrigins === undefined) {
      delete process.env.AUTH_TEST_ALLOWED_ORIGINS
    } else {
      process.env.AUTH_TEST_ALLOWED_ORIGINS = originalTestAllowedOrigins
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV
      return
    }

    process.env.NODE_ENV = originalNodeEnv
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
    process.env.AUTH_TEST_ALLOWED_ORIGINS = 'http://dash.groupher.localhost:3103'

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
    process.env.NODE_ENV = 'production'
    process.env.AUTH_TEST_ALLOWED_ORIGINS = 'http://dash.groupher.localhost:3103'

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
