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

  it('routes dashboard paths to the dashboard origin without trimming dashboard segment', () => {
    const target = resolveCloudflareTarget(
      { pathname: '/home/dashboard/appearance', search: '?tab=theme' },
      env,
    )

    expect(target.kind).toBe('dashboard')
    expect(target.url.toString()).toBe('https://dashboard.test/home/dashboard/appearance?tab=theme')
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

  it('proxies non-landing product paths with a single origin fetch', async () => {
    const response = await worker.fetch(new Request('https://groupher.test/home/post/1'), env)

    expect(await response.text()).toBe('origin')
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
