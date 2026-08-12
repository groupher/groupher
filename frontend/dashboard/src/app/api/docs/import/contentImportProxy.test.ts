import { afterEach, describe, expect, it, vi } from 'vitest'

import { proxyContentImportRequest } from './contentImportProxy'

describe('proxyContentImportRequest', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('returns service unavailable when CONTENT_IMPORT_APP_ENDPOINT is not configured', async () => {
    vi.stubEnv('CONTENT_IMPORT_APP_ENDPOINT', '')
    const fetcher = vi.fn()

    const response = await proxyContentImportRequest(
      new Request('https://dashboard.test/api/docs/import/previews'),
      { backendToken: 'backend-token', fetcher },
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'content_import_unavailable',
        message: 'Content Import endpoint is not configured.',
      },
      ok: false,
    })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('forwards auth scope without browser cookies', async () => {
    vi.stubEnv('CONTENT_IMPORT_APP_ENDPOINT', 'https://content-import.groupher.localhost')
    vi.stubEnv('SERVICE_AUTH_CLIENT_ID', 'dashboard-test')
    vi.stubEnv('SERVICE_AUTH_CLIENT_SECRET', 'dashboard-secret')
    vi.stubEnv('SERVICE_AUTH_TOKEN_ENDPOINT', 'https://auth.test/oauth2/token')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          access_token: 'dashboard-service-token',
          expires_in: 600,
          token_type: 'Bearer',
        }),
      ),
    )
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ok: true }))
    const request = new Request('https://dashboard.test/api/docs/import/previews?community=home', {
      body: JSON.stringify({ community: 'home' }),
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'browser-session=secret',
      },
      method: 'POST',
    })

    await proxyContentImportRequest(request, {
      backendToken: 'backend-token',
      fetcher,
    })

    const [url, init] = fetcher.mock.calls[0]!
    expect(String(url)).toBe(
      'https://content-import.groupher.localhost/api/docs/import/previews?community=home',
    )
    expect(init.method).toBe('POST')
    expect(init.headers.get('authorization')).toBe('Bearer dashboard-service-token')
    expect(init.headers.get('x-groupher-user-authorization')).toBe('Bearer backend-token')
    expect(init.headers.has('x-groupher-backend-token')).toBe(false)
    expect(init.headers.has('x-groupher-user-ref')).toBe(false)
    expect(init.headers.has('cookie')).toBe(false)
    await expect(new Response(init.body).json()).resolves.toEqual({ community: 'home' })
  })
})
