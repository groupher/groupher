import { describe, expect, it, vi } from 'vitest'

import { createApp } from './app'
import { SITE } from './routing'

describe('dev-gateway/app', () => {
  it('serves the Dev Gateway health endpoint', async () => {
    const app = createApp()
    const response = await app.request('http://127.0.0.1:3003/health')

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.schemaVersion).toBe('health.v1')
    expect(body.status).toBe('ok')
    expect(body.service).toBe('dev-gateway')
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

  it('proxies surviving application routes through the resolved Dev Gateway target', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('community'))
    const app = createApp({ fetcher })
    const response = await app.request('http://127.0.0.1:3003/home', {
      headers: { 'x-forwarded-host': 'groupher.localhost' },
    })

    expect(await response.text()).toBe('community')
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, init] = fetcher.mock.calls[0]
    expect(url).toEqual(new URL('/home', SITE.COMMUNITY))
    expect(init?.redirect).toBe('manual')
  })

  it('returns 404 for removed root-domain paths', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('should not proxy'))
    const app = createApp({ fetcher })
    const response = await app.request('http://127.0.0.1:3003/home/dashboard', {
      headers: { 'x-forwarded-host': 'groupher.localhost' },
    })

    expect(response.status).toBe(404)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('does not serve the platform sitemap for a configured custom domain', async () => {
    process.env.CUSTOM_DOMAIN_COMMUNITIES = JSON.stringify({ 'docs.example.com': 'home' })
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('community sitemap'))
    const app = createApp({ fetcher })
    const response = await app.request('http://127.0.0.1:3003/sitemap.xml', {
      headers: { 'x-forwarded-host': 'docs.example.com' },
    })

    expect(await response.text()).toBe('community sitemap')
    expect(fetcher.mock.calls[0][0]).toEqual(new URL('/home/sitemap.xml', SITE.PRESS))
    delete process.env.CUSTOM_DOMAIN_COMMUNITIES
  })
})
