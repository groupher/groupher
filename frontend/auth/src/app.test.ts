import { describe, expect, it, vi } from 'vitest'

import { createApp } from './app'

describe('Auth Hono application', () => {
  it('exposes the service health contract', async () => {
    const response = await createApp().request('/health')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, service: 'auth' })
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

  it('clears the Phoenix token cookie through the custom logout endpoint', async () => {
    const response = await createApp().request('/api/auth/logout', { method: 'POST' })
    const cookie = response.headers.get('set-cookie') || ''

    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(cookie).toContain('groupher-auth.token=')
    expect(cookie).toContain('Max-Age=0')
  })
})
