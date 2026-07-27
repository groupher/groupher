import { afterEach, describe, expect, it, vi } from 'vitest'

import { proxyContentImportRequest } from './contentImportProxy'

describe('proxyContentImportRequest', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns service unavailable when CONTENT_IMPORT_APP_ENDPOINT is not configured', async () => {
    vi.stubEnv('CONTENT_IMPORT_APP_ENDPOINT', '')
    const fetcher = vi.fn()

    const response = await proxyContentImportRequest(
      new Request('https://dashboard.test/api/docs/import/previews'),
      { backendToken: 'backend-token', fetcher, userRef: 'user-1' },
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
      userRef: 'u',
    })

    const [url, init] = fetcher.mock.calls[0]!
    expect(String(url)).toBe(
      'https://content-import.groupher.localhost/api/docs/import/previews?community=home',
    )
    expect(init.method).toBe('POST')
    expect(init.headers.get('authorization')).toBe('Bearer backend-token')
    expect(init.headers.get('x-groupher-backend-token')).toBe('backend-token')
    expect(init.headers.get('x-groupher-user-ref')).toBe('u')
    expect(init.headers.has('cookie')).toBe(false)
    await expect(new Response(init.body).json()).resolves.toEqual({ community: 'home' })
  })
})
