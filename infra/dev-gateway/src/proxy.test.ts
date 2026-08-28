import { GROUPHER_AUTH_TOKEN_COOKIE } from '@groupher/contracts/auth'
import { describe, expect, it, vi } from 'vitest'

import { buildProxyHeaders, buildProxyResponse, proxyRequest } from './proxy'
import type { TGatewayTarget } from './routing'

const makeTarget = (overrides: Partial<TGatewayTarget> = {}): TGatewayTarget => ({
  targetKind: 'community',
  targetUrl: new URL('https://community.groupher.com/home'),
  requestHeaderPolicy: 'pass-through',
  responsePolicy: 'pass-through',
  redirectPolicy: 'preserve-upstream',
  requiresBodyProxy: false,
  ...overrides,
})

describe('gateway/proxy', () => {
  it('preserves forwarded host and removes hop-by-hop headers', () => {
    const request = new Request('https://gateway.groupher.com/home', {
      headers: {
        connection: 'keep-alive',
        host: 'gateway.groupher.com',
        'x-forwarded-host': 'community.groupher.com, internal.local',
      },
    })

    const headers = buildProxyHeaders(request, makeTarget())

    expect(headers.has('connection')).toBe(false)
    expect(headers.has('host')).toBe(false)
    expect(headers.get('x-forwarded-host')).toBe('community.groupher.com')
    expect(headers.get('x-forwarded-proto')).toBe('https')
  })

  it('replaces a client-supplied community slug with trusted route context', () => {
    const request = new Request('https://talk.example.com/post/123', {
      headers: { 'x-groupher-community-slug': 'spoofed' },
    })
    const headers = buildProxyHeaders(request, makeTarget({ communitySlug: 'home' }))

    expect(headers.get('x-groupher-community-slug')).toBe('home')
  })

  it('cleans browser GraphQL credentials and forwards only the Groupher auth token', () => {
    const request = new Request('https://groupher.com/api/graphql', {
      headers: {
        authorization: 'Bearer browser-token',
        cookie: [
          'other=value',
          `${GROUPHER_AUTH_TOKEN_COOKIE}=${encodeURIComponent('phoenix token')}`,
        ].join('; '),
        'content-type': 'application/json',
      },
    })

    const headers = buildProxyHeaders(
      request,
      makeTarget({
        targetKind: 'phoenix',
        requestHeaderPolicy: 'graphql-browser-clean',
      }),
    )

    expect(headers.has('authorization')).toBe(false)
    expect(headers.get('content-type')).toBe('application/json')
    expect(headers.get('cookie')).toBe(`${GROUPHER_AUTH_TOKEN_COOKIE}=phoenix%20token`)
  })

  it('removes browser GraphQL cookies when the Groupher auth token is absent', () => {
    const request = new Request('https://groupher.com/api/graphql', {
      headers: {
        authorization: 'Bearer browser-token',
        cookie: 'other=value',
      },
    })

    const headers = buildProxyHeaders(
      request,
      makeTarget({
        targetKind: 'phoenix',
        requestHeaderPolicy: 'graphql-browser-clean',
      }),
    )

    expect(headers.has('authorization')).toBe(false)
    expect(headers.has('cookie')).toBe(false)
  })

  it('removes credentials from public Press output', () => {
    const request = new Request('https://groupher.com/home/post/a.md', {
      headers: { authorization: 'Bearer private', cookie: 'private=yes' },
    })
    const headers = buildProxyHeaders(
      request,
      makeTarget({ targetKind: 'press', requestHeaderPolicy: 'public-output' }),
    )

    expect(headers.has('authorization')).toBe(false)
    expect(headers.has('cookie')).toBe(false)
  })

  it('forwards method, headers, body, redirect policy, and duplex explicitly', async () => {
    const response = new Response('ok')
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response)
    const request = new Request('https://gateway.groupher.com/api/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{me{id}}' }),
    })

    const proxiedResponse = await proxyRequest(
      request,
      makeTarget({
        targetKind: 'phoenix',
        targetUrl: new URL('https://api.groupher.com/graphiql'),
        requiresBodyProxy: true,
      }),
      { fetcher },
    )

    expect(proxiedResponse.status).toBe(response.status)
    await expect(proxiedResponse.text()).resolves.toBe('ok')

    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, init] = fetcher.mock.calls[0]
    expect(url).toEqual(new URL('https://api.groupher.com/graphiql'))
    expect(init?.method).toBe('POST')
    expect(init?.headers).toBeInstanceOf(Headers)
    expect(init?.body).toBe(request.body)
    expect(init?.redirect).toBe('manual')
    expect((init as RequestInit & { duplex?: string }).duplex).toBe('half')
  })

  it('does not attach a body to GET requests', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('ok'))
    const request = new Request('https://gateway.groupher.com/home')

    await proxyRequest(request, makeTarget(), { fetcher })

    const init = fetcher.mock.calls[0][1]
    expect(init?.method).toBe('GET')
    expect(init?.body).toBeUndefined()
    expect((init as RequestInit & { duplex?: string }).duplex).toBeUndefined()
  })

  it('drops decoded response headers that would make browsers decode plain bodies again', async () => {
    const response = buildProxyResponse(
      new Response('<!DOCTYPE html>', {
        headers: {
          'content-encoding': 'gzip',
          'content-length': '15',
          'content-type': 'text/html; charset=utf-8',
        },
      }),
    )

    expect(response.headers.has('content-encoding')).toBe(false)
    expect(response.headers.has('content-length')).toBe(false)
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8')
    await expect(response.text()).resolves.toBe('<!DOCTYPE html>')
  })
})
