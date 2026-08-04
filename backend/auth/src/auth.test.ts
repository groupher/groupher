import { describe, expect, it, vi } from 'vitest'

import {
  buildAuthConfig,
  buildPhoenixTokenCookie,
  buildSignedInHintCookie,
  createAuthRequestHandler,
  toCanonicalAuthRequest,
} from './auth'

describe('Auth core integration', () => {
  it('normalizes internal Hono requests to the canonical OAuth origin', () => {
    const request = toCanonicalAuthRequest(
      new Request('http://127.0.0.1:3004/api/auth/callback/github?code=abc'),
    )

    expect(request.url).toBe('https://groupher.localhost/api/auth/callback/github?code=abc')
  })

  it('keeps the Phoenix token out of the Auth.js Session payload', async () => {
    const onPhoenixToken = vi.fn()
    const exchangeIdentity = vi.fn(async () => 'phoenix-token')
    const config = buildAuthConfig({ onPhoenixToken, signinOauth: exchangeIdentity })
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

    expect(result).toBe(token)
    expect(result).not.toHaveProperty('auth.token')
    expect(onPhoenixToken).toHaveBeenCalledWith('phoenix-token')
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
            'set-cookie': '__Secure-groupher-auth.session-token=auth-session; Path=/; Secure',
          },
          status: 302,
        })
      },
    )
    const handler = createAuthRequestHandler({
      authCore,
      signinOauth: async () => 'phoenix-token',
    })

    const response = await handler(new Request('http://127.0.0.1:3004/api/auth/callback/github'))
    const cookie = response.headers.get('set-cookie') || ''

    expect(cookie).toContain('__Secure-groupher-auth.session-token=auth-session')
    expect(cookie).toContain('groupher-auth.token=phoenix-token')
    expect(cookie).toContain('groupher-auth.signed-in=1')
  })

  it('does not create a half-login state when Auth.js fails to issue a Session', async () => {
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
      signinOauth: async () => 'phoenix-token',
    })

    const response = await handler(new Request('http://127.0.0.1:3004/api/auth/callback/github'))

    expect(response.headers.get('set-cookie')).toBeNull()
  })
})
