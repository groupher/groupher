import { describe, expect, it, vi } from 'vitest'

import { createApp } from './app'
import { SITE } from './routing'

describe('gateway/app', () => {
  it('serves the gateway health endpoint', async () => {
    const app = createApp()
    const response = await app.request('http://127.0.0.1:3003/health')

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.schemaVersion).toBe('health.v1')
    expect(body.status).toBe('ok')
    expect(body.service).toBe('gateway')
    expect(typeof body.version).toBe('string')
    expect(typeof body.environment).toBe('string')
    expect(typeof body.timestamp).toBe('string')
    expect(typeof body.uptimeMs).toBe('number')
    expect(body.checks).toEqual([])
  })

  it('serves public static files before proxying', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('proxied'))
    const app = createApp({ fetcher })
    const response = await app.request('http://127.0.0.1:3003/robots.txt')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/plain')
    expect(await response.text()).toContain('User-agent: *')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('proxies application routes through the resolved gateway target', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('dashboard'))
    const app = createApp({ fetcher })
    const response = await app.request('http://127.0.0.1:3003/home/dashboard', {
      headers: { 'x-forwarded-host': 'dashboard.groupher.localhost' },
    })

    expect(await response.text()).toBe('dashboard')
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, init] = fetcher.mock.calls[0]
    expect(url).toEqual(new URL('/home/dashboard', SITE.DASHBOARD))
    expect(init?.redirect).toBe('manual')
  })
})
