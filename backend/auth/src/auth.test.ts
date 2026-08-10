import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ACCESS_TOKEN_MAX_AGE,
  BROWSER_SESSION_MAX_AGE,
  BROWSER_SESSION_USER_AGENT_MAX_LENGTH,
  buildAuthConfig,
  buildPhoenixTokenCookie,
  buildSignedInHintCookie,
  createAuthRequestHandler,
  PhoenixBrowserSessionError,
  refreshBrowserSession,
  toCanonicalAuthRequest,
} from './auth'

const browserSession = {
  accessExpiresAt: new Date(Date.now() + ACCESS_TOKEN_MAX_AGE * 1000).toISOString(),
  accessToken: 'phoenix-token',
  browserSessionRef: 'bs_test',
  sessionAbsoluteExpiresAt: new Date(Date.now() + BROWSER_SESSION_MAX_AGE * 1000).toISOString(),
}

describe('Auth core integration', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('preserves Phoenix browser-session machine error codes', async () => {
    vi.stubEnv('GROUPHER_SERVER_TRUST_SECRET', 'server-trust')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          errors: [
            {
              extensions: { code: 'SESSION_REVOKED' },
              message: 'Browser Session revoked.',
            },
          ],
        }),
      ),
    )

    await expect(refreshBrowserSession('bs_revoked')).rejects.toMatchObject({
      code: 'SESSION_REVOKED',
      name: 'PhoenixBrowserSessionError',
    } satisfies Partial<PhoenixBrowserSessionError>)
  })

  it('normalizes internal Hono requests to the canonical OAuth origin', () => {
    const request = toCanonicalAuthRequest(
      new Request('http://127.0.0.1:3004/api/auth/callback/github?code=abc'),
    )

    expect(request.url).toBe('https://groupher.localhost/api/auth/callback/github?code=abc')
  })

  it('keeps the Phoenix token out of the Auth.js Session payload', async () => {
    const onPhoenixSignin = vi.fn()
    const exchangeIdentity = vi.fn(async () => browserSession)
    const config = buildAuthConfig({ onPhoenixSignin, signinOauth: exchangeIdentity })
    const jwt = config.callbacks?.jwt
    if (!jwt) throw new Error('JWT callback is required.')

    const token = { name: 'octocat' }
    const result = await jwt({
      token,
      account: {
        provider: 'github',
        providerAccountId: '42',
        type: 'oauth',
      },
      profile: {
        id: '42',
        login: 'octocat',
        name: 'The Octocat',
      },
      trigger: 'signIn',
      user: {
        id: '42',
      },
    })

    expect(result).not.toBe(token)
    expect(result).not.toHaveProperty('auth.token')
    expect(result).toMatchObject({
      browserSessionRef: 'bs_test',
      sessionAbsoluteExpiresAt: browserSession.sessionAbsoluteExpiresAt,
    })
    expect(onPhoenixSignin).toHaveBeenCalledWith(browserSession)
  })

  it('serializes the canonical Phoenix token cookie', () => {
    expect(buildPhoenixTokenCookie('phoenix-token')).toContain('groupher-auth.token=phoenix-token')
    expect(buildPhoenixTokenCookie('phoenix-token')).toContain('HttpOnly')
  })

  it('serializes a readable signed-in hint cookie without exposing the token', () => {
    const cookie = buildSignedInHintCookie()

    expect(cookie).toContain('groupher-auth.signed-in=1')
    expect(cookie).not.toContain('HttpOnly')
  })

  it('adds the Phoenix token only after Auth.js issues its Session cookie', async () => {
    const authCore = vi.fn(
      async (_request: Request, config: ReturnType<typeof buildAuthConfig>) => {
        const jwt = config.callbacks?.jwt
        if (!jwt) throw new Error('JWT callback is required.')
        await jwt({
          token: { name: 'octocat' },
          account: {
            provider: 'github',
            providerAccountId: '42',
            type: 'oauth',
          },
          profile: {
            id: '42',
            login: 'octocat',
          },
          trigger: 'signIn',
          user: { id: '42' },
        })

        return new Response(null, {
          headers: {
            'set-cookie': '__Host-groupher-auth.session-token=auth-session; Path=/; Secure',
          },
          status: 302,
        })
      },
    )
    const handler = createAuthRequestHandler({
      authCore,
      signinOauth: async () => browserSession,
    })

    const response = await handler(new Request('http://127.0.0.1:3004/api/auth/callback/github'))
    const cookie = response.headers.get('set-cookie') || ''

    expect(cookie).toContain('__Host-groupher-auth.session-token=auth-session')
    expect(cookie).toContain('groupher-auth.token=phoenix-token')
    expect(cookie).toContain('groupher-auth.signed-in=1')
  })

  it('does not create a half-login state when Auth.js fails to issue a Session', async () => {
    const revokeBrowserSession = vi.fn(async () => undefined)
    const authCore = vi.fn(
      async (_request: Request, config: ReturnType<typeof buildAuthConfig>) => {
        const jwt = config.callbacks?.jwt
        if (!jwt) throw new Error('JWT callback is required.')
        await jwt({
          token: { name: 'octocat' },
          account: {
            provider: 'github',
            providerAccountId: '42',
            type: 'oauth',
          },
          profile: {
            id: '42',
            login: 'octocat',
          },
          trigger: 'signIn',
          user: { id: '42' },
        })

        return Response.redirect('https://groupher.localhost/api/auth/error')
      },
    )
    const handler = createAuthRequestHandler({
      authCore,
      revokeBrowserSession,
      signinOauth: async () => browserSession,
    })

    const response = await handler(new Request('http://127.0.0.1:3004/api/auth/callback/github'))

    expect(response.headers.get('set-cookie')).toBeNull()
    expect(revokeBrowserSession).toHaveBeenCalledWith(browserSession.browserSessionRef)
  })

  it('bounds persisted user-agent metadata to the browser-session column length', async () => {
    const signin = vi.fn(
      async (_provider: Record<string, unknown>, metadata?: { userAgentSummary?: string }) => {
        void metadata
        return browserSession
      },
    )
    const authCore = vi.fn(
      async (_request: Request, config: ReturnType<typeof buildAuthConfig>) => {
        const jwt = config.callbacks?.jwt
        if (!jwt) throw new Error('JWT callback is required.')
        await jwt({
          token: { name: 'octocat' },
          account: { provider: 'github', providerAccountId: '42', type: 'oauth' },
          profile: { id: '42', login: 'octocat' },
          trigger: 'signIn',
          user: { id: '42' },
        })
        return new Response(null, {
          headers: {
            'set-cookie': '__Host-groupher-auth.session-token=auth-session; Path=/; Secure',
          },
          status: 302,
        })
      },
    )
    const handler = createAuthRequestHandler({ authCore, signinOauth: signin })

    await handler(
      new Request('http://127.0.0.1:3004/api/auth/callback/github', {
        headers: { 'user-agent': 'u'.repeat(BROWSER_SESSION_USER_AGENT_MAX_LENGTH + 100) },
      }),
    )

    const metadata = signin.mock.calls[0]?.[1]
    expect(metadata?.userAgentSummary).toHaveLength(BROWSER_SESSION_USER_AGENT_MAX_LENGTH)
  })
})
