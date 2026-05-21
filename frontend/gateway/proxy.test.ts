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

const makeRequest = (pathname: string, host: string, search = '') => {
  return {
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
