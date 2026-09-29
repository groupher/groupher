import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { proxyGraphQLRequest } from './proxy'

describe('proxyGraphQLRequest', () => {
  beforeEach(() => {
    vi.stubEnv('GRAPHQL_ENDPOINT', 'https://api.groupher.test/graphiql')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('forwards only Groupher auth and viewer session cookies', async () => {
    const token = 'phoenix token'
    const fetcher = vi.fn(async () => Response.json({ data: { me: { login: 'dev' } } }))
    const request = new Request('https://groupher.test/api/graphql?query=%7Bme%7Blogin%7D%7D', {
      headers: {
        accept: 'application/json',
        authorization: 'Bearer browser-token',
        cookie: `theme=dark; groupher-auth.token=${encodeURIComponent(token)}; groupher-viewer=visitor-1`,
        'user-agent': 'GroupherBrowser/1.0',
        'x-forwarded-for': '203.0.113.2',
        'x-vercel-id': 'sfo1::edge::request',
      },
    })

    const response = await proxyGraphQLRequest(request, fetcher)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: { me: { login: 'dev' } } })
    expect(fetcher).toHaveBeenCalledOnce()

    const [url, init] = fetcher.mock.calls[0]! as unknown as [URL, RequestInit]
    const headers = init.headers as Headers

    expect(String(url)).toBe('https://api.groupher.test/graphiql?query=%7Bme%7Blogin%7D%7D')
    expect(headers.has('authorization')).toBe(false)
    expect(headers.get('cookie')).toBe(
      'groupher-auth.token=phoenix%20token; groupher-viewer=visitor-1',
    )
    expect(headers.get('accept')).toBe('application/json')
    expect(headers.get('user-agent')).toBe('GroupherBrowser/1.0')
    expect(headers.has('x-forwarded-for')).toBe(false)
    expect(headers.has('x-vercel-id')).toBe(false)
  })

  it('forwards an anonymous viewer session without an auth cookie', async () => {
    const fetcher = vi.fn(async () =>
      Response.json(
        { data: { trackArticleView: { tracked: true } } },
        { headers: { 'set-cookie': 'groupher-viewer=visitor-2; Path=/; HttpOnly' } },
      ),
    )
    const request = new Request('https://groupher.test/api/graphql', {
      body: JSON.stringify({ query: 'mutation { trackArticleView { tracked } }' }),
      headers: {
        cookie: 'theme=dark; groupher-viewer=visitor-1',
        'content-type': 'application/json',
        'x-groupher-csrf': '1',
      },
      method: 'POST',
    })

    const response = await proxyGraphQLRequest(request, fetcher)
    const [, init] = fetcher.mock.calls[0]! as unknown as [URL, RequestInit]

    expect((init.headers as Headers).get('cookie')).toBe('groupher-viewer=visitor-1')
    expect(response.headers.get('set-cookie')).toContain('groupher-viewer=visitor-2')
  })

  it('keeps anonymous GraphQL requests anonymous', async () => {
    const fetcher = vi.fn(async () => Response.json({ data: { me: null } }))
    const request = new Request('https://groupher.test/api/graphql', {
      body: JSON.stringify({ query: '{ me { login } }' }),
      headers: {
        'content-type': 'application/json',
        'x-groupher-csrf': '1',
      },
      method: 'POST',
    })

    await proxyGraphQLRequest(request, fetcher)

    const [, init] = fetcher.mock.calls[0]! as unknown as [URL, RequestInit]
    const headers = init.headers as Headers

    expect(init.method).toBe('POST')
    expect(headers.get('content-type')).toBe('application/json')
    expect(headers.has('authorization')).toBe(false)
    expect(headers.has('cookie')).toBe(false)
    expect(await new Response(init.body).text()).toBe('{"query":"{ me { login } }"}')
  })

  it('does not forward compression metadata after fetch decodes the body', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: { me: null } }), {
          headers: {
            'content-encoding': 'gzip',
            'content-length': '22',
            'content-type': 'application/json',
          },
        }),
    )

    const response = await proxyGraphQLRequest(
      new Request('https://groupher.test/api/graphql?query=%7Bme%7D'),
      fetcher,
    )

    expect(response.headers.has('content-encoding')).toBe(false)
    expect(response.headers.has('content-length')).toBe(false)
    expect(await response.json()).toEqual({ data: { me: null } })
  })

  it('preserves multiple upstream Set-Cookie values', async () => {
    const upstream = new Headers({ 'content-type': 'application/json' })
    upstream.append('set-cookie', 'groupher-viewer=visitor-2; Path=/; HttpOnly')
    upstream.append('set-cookie', 'groupher-auth.token=token-2; Path=/; HttpOnly')
    const fetcher = vi.fn(async () => new Response('{"data":{}}', { headers: upstream }))

    const response = await proxyGraphQLRequest(
      new Request('https://groupher.test/api/graphql'),
      fetcher,
    )

    const cookies = response.headers.getSetCookie?.() || []
    expect(cookies).toHaveLength(2)
    expect(cookies[0]).toContain('groupher-viewer=visitor-2')
    expect(cookies[1]).toContain('groupher-auth.token=token-2')
  })
})
