import { describe, expect, it, vi } from 'vitest'

import { createApp } from './app'

describe('Auth Hono application', () => {
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

  it('forwards Auth.js protocol requests to the core handler', async () => {
    const authHandler = vi.fn(async (_request: Request) => Response.json({ providers: ['github'] }))
    const app = createApp({ authHandler })

    const response = await app.request('/api/auth/providers')

    expect(response.status).toBe(200)
    expect(authHandler).toHaveBeenCalledTimes(1)
    const forwardedRequest = authHandler.mock.calls[0]?.[0]
    expect(forwardedRequest && new URL(forwardedRequest.url).pathname).toBe('/api/auth/providers')
  })

  it('clears Phoenix and Auth cookies through the custom logout endpoint', async () => {
    const response = await createApp().request('/api/auth/logout', {
      method: 'POST',
      headers: {
        cookie: [
          'groupher-auth.token=phoenix-token',
          '__Secure-groupher-auth.session-token.0=session-a',
          '__Secure-groupher-auth.session-token.1=session-b',
          '__Secure-groupher-auth.csrf-token=csrf',
        ].join('; '),
      },
    })
    const cookie = response.headers.get('set-cookie') || ''

    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(cookie).toContain('groupher-auth.token=')
    expect(cookie).toContain('__Secure-groupher-auth.session-token=')
    expect(cookie).toContain('__Secure-groupher-auth.session-token.0=')
    expect(cookie).toContain('__Secure-groupher-auth.session-token.1=')
    expect(cookie).toContain('__Secure-groupher-auth.csrf-token=')
    expect(cookie).toContain('Max-Age=0')
  })
})
