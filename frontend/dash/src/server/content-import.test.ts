import { describe, expect, it, vi } from 'vitest'

import { proxyContentImportRequest } from './content-import'

describe('proxyContentImportRequest', () => {
  it('returns service unavailable when the endpoint is not configured', async () => {
    vi.stubEnv('CONTENT_IMPORT_APP_ENDPOINT', '')
    const fetcher = vi.fn()

    const response = await proxyContentImportRequest(
      new Request('https://dash.test/api/docs/import/previews'),
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

  it('forwards the delegated user and Dash service identity without browser cookies', async () => {
    vi.stubEnv('CONTENT_IMPORT_APP_ENDPOINT', 'https://content-import.groupher.localhost')
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ok: true }))
    const serviceAuthClient = {
      getToken: vi.fn().mockResolvedValue('dash-service-token'),
    }
    const request = new Request('https://dash.test/api/docs/import/previews?community=home', {
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
      serviceAuthClient,
    })

    expect(serviceAuthClient.getToken).toHaveBeenCalledWith({
      resource: 'https://content-import.groupher.com/internal',
      scopes: ['docs:import:proxy'],
    })
    const [url, init] = fetcher.mock.calls[0]!
    expect(String(url)).toBe(
      'https://content-import.groupher.localhost/api/docs/import/previews?community=home',
    )
    expect(init.method).toBe('POST')
    expect(init.headers.get('authorization')).toBe('Bearer dash-service-token')
    expect(init.headers.get('x-groupher-user-authorization')).toBe('Bearer backend-token')
    expect(init.headers.has('cookie')).toBe(false)
    await expect(new Response(init.body).json()).resolves.toEqual({ community: 'home' })
  })
})
