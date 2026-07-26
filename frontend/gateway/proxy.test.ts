import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/server', () => {
  return {
    NextResponse: {
      rewrite: vi.fn((url: URL) => url),
    },
  }
})

import { NextResponse } from 'next/server'

import proxy from './proxy'
import { SITE } from './utils'

const rewriteMock = vi.mocked(NextResponse.rewrite)
type TProxyRequest = Parameters<typeof proxy>[0]

const makeRequest = (
  pathname: string,
  host: string,
  search = '',
  forwardedHost?: string,
  backendToken?: string,
) => {
  const headers = new Headers()
  if (forwardedHost) headers.set('x-forwarded-host', forwardedHost)
  headers.set('content-type', 'application/json')
  headers.set('authorization', 'Bearer browser-supplied-token')

  return {
    headers,
    cookies: {
      get: (name: string) =>
        name === 'groupher-auth.token' && backendToken ? { value: backendToken } : undefined,
    },
    nextUrl: {
      pathname,
      host,
      search,
    },
  }
}

describe('gateway/proxy', () => {
  const getRewrittenUrl = (): URL => {
    expect(rewriteMock).toHaveBeenCalledTimes(1)
    const call = rewriteMock.mock.calls[0]
    const rewritten = call?.[0]
    expect(rewritten).toBeInstanceOf(URL)
    return rewritten as URL
  }

  beforeEach(() => {
    rewriteMock.mockClear()
  })

  it('rewrites auth routes to the auth application before product routes', () => {
    proxy(
      makeRequest(
        '/api/auth/callback/github',
        'www.groupher.com',
        '?code=abc&state=xyz',
      ) as unknown as TProxyRequest,
    )
    const rewritten = getRewrittenUrl()
    expect(rewritten.origin).toBe(new URL(SITE.AUTH).origin)
    expect(rewritten.pathname).toBe('/api/auth/callback/github')
    expect(rewritten.search).toBe('?code=abc&state=xyz')
  })

  it('rewrites auth routes from the Dashboard subdomain to Auth', () => {
    proxy(
      makeRequest(
        '/api/auth/signin/github',
        'dashboard.groupher.localhost',
        '?callbackUrl=%2Fhome%2Fdashboard',
      ) as unknown as TProxyRequest,
    )
    const rewritten = getRewrittenUrl()
    expect(rewritten.origin).toBe(new URL(SITE.AUTH).origin)
    expect(rewritten.pathname).toBe('/api/auth/signin/github')
  })

  it('rewrites the same-origin browser GraphQL route to Phoenix before product routes', () => {
    proxy(
      makeRequest(
        '/api/graphql',
        'dashboard.groupher.localhost',
        '?query=%7Bme%7Blogin%7D%7D',
        undefined,
        'phoenix-token',
      ) as unknown as TProxyRequest,
    )
    const rewritten = getRewrittenUrl()
    expect(rewritten.origin).toBe(new URL(SITE.API).origin)
    expect(rewritten.pathname).toBe('/graphiql')
    expect(rewritten.search).toBe('?query=%7Bme%7Blogin%7D%7D')

    const options = rewriteMock.mock.calls[0]?.[1]
    const headers = options?.request?.headers as Headers
    expect(headers.has('authorization')).toBe(false)
    expect(headers.get('content-type')).toBe('application/json')
    expect(headers.get('cookie')).toBe('groupher-auth.token=phoenix-token')
  })

  it('does not forward browser-supplied authorization without a Groupher auth cookie', () => {
    proxy(makeRequest('/api/graphql', 'dashboard.groupher.localhost') as unknown as TProxyRequest)

    const options = rewriteMock.mock.calls[0]?.[1]
    const headers = options?.request?.headers as Headers
    expect(headers.has('authorization')).toBe(false)
    expect(headers.has('cookie')).toBe(false)
  })

  it('routes explicit Main and Landing subdomains before canonical path rules', () => {
    proxy(makeRequest('/', 'main.groupher.localhost') as unknown as TProxyRequest)
    expect(getRewrittenUrl().origin).toBe(new URL(SITE.MAIN).origin)

    rewriteMock.mockClear()
    proxy(makeRequest('/unknown', 'landing.groupher.localhost') as unknown as TProxyRequest)
    expect(getRewrittenUrl().origin).toBe(new URL(SITE.LANDING).origin)
  })

  it('rewrites dashboard route to dashboard site and trims /dashboard suffix', () => {
    proxy(makeRequest('/cps/dashboard', 'www.groupher.com', '?page=1') as unknown as TProxyRequest)
    const rewritten = getRewrittenUrl()
    expect(rewritten.origin).toBe(new URL(SITE.DASHBOARD).origin)
    expect(rewritten.pathname).toBe('/cps')
    expect(rewritten.search).toBe('?page=1')
  })

  it('rewrites nested dashboard route to dashboard site and keeps real route segments', () => {
    proxy(
      makeRequest(
        '/cps/dashboard/appearance/kanban',
        'www.groupher.com',
        '?tab=preview',
      ) as unknown as TProxyRequest,
    )
    const rewritten = getRewrittenUrl()
    expect(rewritten.origin).toBe(new URL(SITE.DASHBOARD).origin)
    expect(rewritten.pathname).toBe('/cps/appearance/kanban')
    expect(rewritten.search).toBe('?tab=preview')
  })

  it('keeps nested dashboard route on dashboard subdomain', () => {
    proxy(
      makeRequest(
        '/cps/appearance/kanban',
        'dashboard.groupher.com',
        '?tab=preview',
      ) as unknown as TProxyRequest,
    )
    const rewritten = getRewrittenUrl()
    expect(rewritten.origin).toBe(new URL(SITE.DASHBOARD).origin)
    expect(rewritten.pathname).toBe('/cps/appearance/kanban')
    expect(rewritten.search).toBe('?tab=preview')
  })

  it('uses the original Portless host instead of the Gateway listener host', () => {
    proxy(
      makeRequest(
        '/home/dashboard',
        '127.0.0.1:3003',
        '',
        'dashboard.groupher.localhost',
      ) as unknown as TProxyRequest,
    )
    const rewritten = getRewrittenUrl()
    expect(rewritten.origin).toBe(new URL(SITE.DASHBOARD).origin)
    expect(rewritten.pathname).toBe('/home/dashboard')
  })

  it('rewrites dashboard static route to dashboard site', () => {
    proxy(
      makeRequest(
        '/dashboard/_next/static/chunks/app.js',
        'www.groupher.com',
        '?v=1',
      ) as unknown as TProxyRequest,
    )
    const rewritten = getRewrittenUrl()
    expect(rewritten.origin).toBe(new URL(SITE.DASHBOARD).origin)
    expect(rewritten.pathname).toBe('/dashboard/_next/static/chunks/app.js')
    expect(rewritten.search).toBe('?v=1')
  })

  it('rewrites landing static route to landing site', () => {
    proxy(
      makeRequest(
        '/landing/_next/static/chunks/app.js',
        'www.groupher.com',
        '?v=2',
      ) as unknown as TProxyRequest,
    )
    const rewritten = getRewrittenUrl()
    expect(rewritten.origin).toBe(new URL(SITE.LANDING).origin)
    expect(rewritten.pathname).toBe('/landing/_next/static/chunks/app.js')
    expect(rewritten.search).toBe('?v=2')
  })

  it('rewrites landing static page path to landing site', () => {
    proxy(makeRequest('/pricing', 'www.groupher.com', '?ref=ad') as unknown as TProxyRequest)
    const rewritten = getRewrittenUrl()
    expect(rewritten.origin).toBe(new URL(SITE.LANDING).origin)
    expect(rewritten.pathname).toBe('/pricing')
    expect(rewritten.search).toBe('?ref=ad')
  })

  it('rewrites other routes to main site', () => {
    proxy(makeRequest('/unknown', 'www.groupher.com', '?k=v') as unknown as TProxyRequest)
    const rewritten = getRewrittenUrl()
    expect(rewritten.origin).toBe(new URL(SITE.MAIN).origin)
    expect(rewritten.pathname).toBe('/unknown')
    expect(rewritten.search).toBe('?k=v')
  })

  it('does not misclassify non-dashboard routes', () => {
    proxy(makeRequest('/foo/bar/dashboard', 'www.groupher.com', '?k=v') as unknown as TProxyRequest)
    const rewritten = getRewrittenUrl()
    expect(rewritten.origin).toBe(new URL(SITE.MAIN).origin)
    expect(rewritten.pathname).toBe('/foo/bar/dashboard')
    expect(rewritten.search).toBe('?k=v')
  })
})
