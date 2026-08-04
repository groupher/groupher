import { createHmac } from 'node:crypto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { proxyGraphQLRequest } from './proxy'

const base64UrlEncode = (value: unknown): string =>
  Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url')

const signedToken = (
  payload: Record<string, unknown> = {},
  secret = 'phoenix-jwt-secret',
): string => {
  const header = base64UrlEncode({ alg: 'HS512', typ: 'JWT' })
  const body = base64UrlEncode({
    exp: Math.floor(Date.now() / 1000) + 60,
    iss: 'groupher_server',
    sub: '42',
    ...payload,
  })
  const signature = createHmac('sha512', secret).update(`${header}.${body}`).digest('base64url')

  return `${header}.${body}.${signature}`
}

describe('proxyGraphQLRequest', () => {
  beforeEach(() => {
    vi.stubEnv('GRAPHQL_ENDPOINT', 'https://api.groupher.test/graphiql')
    vi.stubEnv('PHX_JWT_SECRET', 'phoenix-jwt-secret')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('forwards GraphQL requests to the server endpoint with bearer auth', async () => {
    const token = signedToken()
    const fetcher = vi.fn(async () => Response.json({ data: { me: { login: 'dev' } } }))
    const request = new Request('https://groupher.test/api/graphql?query=%7Bme%7Blogin%7D%7D', {
      headers: {
        cookie: `theme=dark; groupher-auth.token=${encodeURIComponent(token)}`,
      },
    })

    const response = await proxyGraphQLRequest(request, fetcher)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: { me: { login: 'dev' } } })
    expect(fetcher).toHaveBeenCalledOnce()

    const [url, init] = fetcher.mock.calls[0]! as unknown as [URL, RequestInit]
    const headers = init.headers as Headers

    expect(String(url)).toBe('https://api.groupher.test/graphiql?query=%7Bme%7Blogin%7D%7D')
    expect(headers.get('authorization')).toBe(`Bearer ${token}`)
    expect(headers.has('cookie')).toBe(false)
  })

  it('keeps anonymous GraphQL requests anonymous', async () => {
    const fetcher = vi.fn(async () => Response.json({ data: { me: null } }))
    const request = new Request('https://groupher.test/api/graphql', {
      body: JSON.stringify({ query: '{ me { login } }' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

    await proxyGraphQLRequest(request, fetcher)

    const [, init] = fetcher.mock.calls[0]! as unknown as [URL, RequestInit]
    const headers = init.headers as Headers

    expect(init.method).toBe('POST')
    expect(headers.has('authorization')).toBe(false)
    expect(headers.has('cookie')).toBe(false)
    expect(await new Response(init.body).text()).toBe('{"query":"{ me { login } }"}')
  })
})
