import { beforeEach, describe, expect, it, vi } from 'vitest'

import worker, { buildProxyHeaders, resolveCloudflareTarget } from '../public/_worker.js'

const env = {
  ASSETS: {
    fetch: vi.fn(async () => new Response('asset')),
  },
  MAIN_SITE: 'https://main.test',
  DASHBOARD_SITE: 'https://dashboard.test',
  AUTH_SITE: 'https://auth.test',
  API_SITE: 'https://api.test',
  fetcher: vi.fn(async (_url: URL, _init: RequestInit) => new Response('origin')),
}

describe('landing Cloudflare worker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('serves explicit landing paths from Pages assets', async () => {
    const response = await worker.fetch(new Request('https://groupher.test/pricing'), env)

    expect(await response.text()).toBe('asset')
    expect(env.ASSETS.fetch).toHaveBeenCalledOnce()
    expect(env.fetcher).not.toHaveBeenCalled()
  })

  it('serves explicit landing paths with trailing slash from Pages assets', async () => {
    const response = await worker.fetch(new Request('https://groupher.test/book-demo/'), env)

    expect(await response.text()).toBe('asset')
    expect(env.ASSETS.fetch).toHaveBeenCalledOnce()
    expect(env.fetcher).not.toHaveBeenCalled()
  })

  it('routes dashboard paths to the dashboard origin without trimming dashboard segment', () => {
    const target = resolveCloudflareTarget(
      { pathname: '/home/dashboard/appearance', search: '?tab=theme' },
      env,
    )

    expect(target.kind).toBe('dashboard')
    expect(target.url.toString()).toBe('https://dashboard.test/home/dashboard/appearance?tab=theme')
  })

  it('routes dashboard static chunks to the dashboard origin', () => {
    const target = resolveCloudflareTarget(
      { pathname: '/dashboard/_next/static/chunks/app/home.js' },
      env,
    )

    expect(target.kind).toBe('dashboard')
    expect(target.url.toString()).toBe(
      'https://dashboard.test/dashboard/_next/static/chunks/app/home.js',
    )
  })

  it('routes dashboard-owned API routes to the dashboard origin', () => {
    const target = resolveCloudflareTarget(
      { pathname: '/api/docs/import/previews', search: '?community=home' },
      env,
    )

    expect(target.kind).toBe('dashboard')
    expect(target.url.toString()).toBe(
      'https://dashboard.test/api/docs/import/previews?community=home',
    )
  })

  it('routes the Auth.js base path to the auth origin', () => {
    const target = resolveCloudflareTarget({ pathname: '/api/auth' }, env)

    expect(target.kind).toBe('auth')
    expect(target.url.toString()).toBe('https://auth.test/api/auth')
  })

  it('routes GraphQL facade to Phoenix GraphQL origin', () => {
    const target = resolveCloudflareTarget({ pathname: '/api/graphql' }, env)

    expect(target.kind).toBe('phoenix')
    expect(target.url.toString()).toBe('https://api.test/graphiql')
    expect(target.requestHeaderPolicy).toBe('graphql-browser-clean')
  })

  it('cleans browser GraphQL credentials and forwards only Groupher auth token', () => {
    const request = new Request('https://groupher.test/api/graphql', {
      headers: {
        authorization: 'Bearer browser-token',
        cookie: [
          'other=value',
          'groupher-auth.token=phoenix%20token',
          'next-auth.session-token=session',
        ].join('; '),
      },
    })
    const target = resolveCloudflareTarget({ pathname: '/api/graphql' }, env)
    const headers = buildProxyHeaders(request, target)

    expect(headers.has('authorization')).toBe(false)
    expect(headers.get('cookie')).toBe('groupher-auth.token=phoenix%20token')
  })

  it('overwrites client-controlled forwarded host metadata', () => {
    const request = new Request('https://groupher.test/home', {
      headers: {
        forwarded: 'host=evil.test;proto=http',
        'x-forwarded-host': 'evil.test',
        'x-forwarded-proto': 'http',
      },
    })
    const target = resolveCloudflareTarget({ pathname: '/home' }, env)
    const headers = buildProxyHeaders(request, target)

    expect(headers.has('forwarded')).toBe(false)
    expect(headers.get('x-forwarded-host')).toBe('groupher.test')
    expect(headers.get('x-forwarded-proto')).toBe('https')
  })

  it('rebuilds x-forwarded-for from the Cloudflare connecting IP', () => {
    const request = new Request('https://groupher.test/home', {
      headers: {
        'cf-connecting-ip': '203.0.113.12',
        'x-forwarded-for': '198.51.100.99',
      },
    })
    const target = resolveCloudflareTarget({ pathname: '/home' }, env)
    const headers = buildProxyHeaders(request, target)

    expect(headers.get('x-forwarded-for')).toBe('203.0.113.12')
  })

  it('does not forward a spoofed x-forwarded-for without a Cloudflare connecting IP', () => {
    const request = new Request('https://groupher.test/home', {
      headers: {
        'x-forwarded-for': '198.51.100.99',
      },
    })
    const target = resolveCloudflareTarget({ pathname: '/home' }, env)
    const headers = buildProxyHeaders(request, target)

    expect(headers.has('x-forwarded-for')).toBe(false)
  })

  it('serves landing static assets from Pages assets in advanced worker mode', async () => {
    const response = await worker.fetch(
      new Request('https://groupher.test/locales/en/base.json'),
      env,
    )

    expect(await response.text()).toBe('asset')
    expect(env.ASSETS.fetch).toHaveBeenCalledOnce()
    expect(env.fetcher).not.toHaveBeenCalled()
  })

  it('serves bundled landing media from Pages assets', async () => {
    const response = await worker.fetch(
      new Request('https://groupher.test/landing/products/github.png'),
      env,
    )

    expect(await response.text()).toBe('asset')
    expect(env.ASSETS.fetch).toHaveBeenCalledOnce()
    expect(env.fetcher).not.toHaveBeenCalled()
  })

  it('keeps product paths under /landing routed through the product router', () => {
    const target = resolveCloudflareTarget({ pathname: '/landing-community/guide' }, env)

    expect(target.kind).toBe('main')
    expect(target.url.toString()).toBe('https://main.test/landing-community/guide')
  })

  it('keeps double-slash paths on the configured Groupher origin', () => {
    const target = resolveCloudflareTarget({ pathname: '//evil.example/session' }, env)

    expect(target.kind).toBe('main')
    expect(target.url.origin).toBe('https://main.test')
    expect(target.url.pathname).toBe('//evil.example/session')
  })

  it('proxies non-landing product paths with a single origin fetch', async () => {
    const response = await worker.fetch(new Request('https://groupher.test/home/post/1'), env)

    expect(await response.text()).toBe('origin')
    expect(env.ASSETS.fetch).not.toHaveBeenCalled()
    expect(env.fetcher).toHaveBeenCalledOnce()
    const [url] = env.fetcher.mock.calls[0]
    expect(url.toString()).toBe('https://main.test/home/post/1')
  })

  it('proxies root Next static chunks to the main origin', async () => {
    const response = await worker.fetch(
      new Request('https://groupher.test/_next/static/immutable/chunks/app.css'),
      env,
    )

    expect(await response.text()).toBe('origin')
    expect(env.ASSETS.fetch).not.toHaveBeenCalled()
    expect(env.fetcher).toHaveBeenCalledOnce()
    const [url] = env.fetcher.mock.calls[0]
    expect(url.toString()).toBe('https://main.test/_next/static/immutable/chunks/app.css')
  })
})
