import { describe, expect, it } from 'vitest'

import {
  getDashboardUrl,
  isAuthRoute,
  isDashboardRoute,
  isDashboardStaticRoute,
  isGraphqlRoute,
  isLandingHost,
  isLandingStaticRoute,
  isMainHost,
  resolveGatewayTarget,
  SITE,
} from './routing'

describe('gateway/routing', () => {
  describe('isAuthRoute', () => {
    it('only matches the Auth.js route namespace', () => {
      expect(isAuthRoute('/api/auth/signin/github')).toBe(true)
      expect(isAuthRoute('/api/auth/callback/github')).toBe(true)
      expect(isAuthRoute('/api/articles')).toBe(false)
      expect(isAuthRoute('/auth/profile')).toBe(false)
    })
  })

  describe('isGraphqlRoute', () => {
    it('only matches the Gateway browser GraphQL endpoint', () => {
      expect(isGraphqlRoute('/api/graphql')).toBe(true)
      expect(isGraphqlRoute('/api/graphql/')).toBe(false)
      expect(isGraphqlRoute('/graphiql')).toBe(false)
    })
  })

  describe('app hosts', () => {
    it('recognizes explicit Main and Landing subdomains', () => {
      expect(isMainHost('main.groupher.localhost')).toBe(true)
      expect(isMainHost('dashboard.groupher.localhost')).toBe(false)
      expect(isLandingHost('landing.groupher.localhost')).toBe(true)
      expect(isLandingHost('groupher.localhost')).toBe(false)
    })
  })

  describe('isDashboardRoute', () => {
    it('returns true for dashboard subdomain', () => {
      expect(isDashboardRoute('/cps', 'dashboard.groupher.com')).toBe(true)
    })

    it('returns true for /xxx/dashboard pattern', () => {
      expect(isDashboardRoute('/cps/dashboard', 'www.groupher.com')).toBe(true)
      expect(isDashboardRoute('/cps/dashboard/appearance', 'www.groupher.com')).toBe(true)
      expect(isDashboardRoute('/cps/dashboard/appearance/kanban', 'www.groupher.com')).toBe(true)
    })

    it('returns false for non-dashboard route', () => {
      expect(isDashboardRoute('/organizations/settings/dashboard', 'www.groupher.com')).toBe(false)
      expect(isDashboardRoute('/foo/bar/dashboard', 'www.groupher.com')).toBe(false)
      expect(isDashboardRoute('/cps/overview', 'www.groupher.com')).toBe(false)
      expect(isDashboardRoute('/cps', 'www.groupher.com')).toBe(false)
    })
  })

  describe('static route predicates', () => {
    it('detects landing static routes', () => {
      expect(isLandingStaticRoute('/landing/_next/static/chunks/app.js')).toBe(true)
      expect(isLandingStaticRoute('/dashboard/_next/static/chunks/app.js')).toBe(false)
    })

    it('detects dashboard static routes', () => {
      expect(isDashboardStaticRoute('/dashboard/_next/static/chunks/app.js')).toBe(true)
      expect(isDashboardStaticRoute('/landing/_next/static/chunks/app.js')).toBe(false)
    })
  })

  describe('getDashboardUrl', () => {
    it('keeps pathname/search for dashboard subdomain', () => {
      const url = getDashboardUrl('/cps', 'dashboard.groupher.com', '?page=1&tab=a')
      expect(url.origin).toBe(new URL(SITE.DASHBOARD).origin)
      expect(url.pathname).toBe('/cps')
      expect(url.search).toBe('?page=1&tab=a')
    })

    it('rewrites /xxx/dashboard to /xxx', () => {
      const url = getDashboardUrl('/cps/dashboard', 'www.groupher.com', '?page=2')
      expect(url.origin).toBe(new URL(SITE.DASHBOARD).origin)
      expect(url.pathname).toBe('/cps')
      expect(url.search).toBe('?page=2')
    })

    it('keeps nested dashboard route segments', () => {
      const url = getDashboardUrl(
        '/cps/dashboard/appearance/kanban',
        'www.groupher.com',
        '?tab=preview',
      )
      expect(url.origin).toBe(new URL(SITE.DASHBOARD).origin)
      expect(url.pathname).toBe('/cps/appearance/kanban')
      expect(url.search).toBe('?tab=preview')
    })

    it('keeps nested dashboard route segments for dashboard subdomain', () => {
      const url = getDashboardUrl(
        '/cps/appearance/kanban',
        'dashboard.groupher.com',
        '?tab=preview',
      )
      expect(url.origin).toBe(new URL(SITE.DASHBOARD).origin)
      expect(url.pathname).toBe('/cps/appearance/kanban')
      expect(url.search).toBe('?tab=preview')
    })

    it('falls back to dashboard home for unexpected path', () => {
      const url = getDashboardUrl('/dashboard', 'www.groupher.com', '')
      expect(url.origin).toBe(new URL(SITE.DASHBOARD).origin)
      expect(url.pathname).toBe('/')
      expect(url.search).toBe('')
    })
  })

  describe('resolveGatewayTarget', () => {
    const resolve = (
      pathname: string,
      host: string,
      search = '',
      forwardedHost?: string,
      method = 'GET',
      referer?: string,
    ) =>
      resolveGatewayTarget({
        pathname,
        search,
        host,
        forwardedHost,
        method,
        referer,
      })

    it('routes auth before product routes', () => {
      const target = resolve('/api/auth/callback/github', 'www.groupher.com', '?code=abc&state=xyz')

      expect(target.targetKind).toBe('auth')
      expect(target.targetUrl.origin).toBe(new URL(SITE.AUTH).origin)
      expect(target.targetUrl.pathname).toBe('/api/auth/callback/github')
      expect(target.targetUrl.search).toBe('?code=abc&state=xyz')
    })

    it('routes browser GraphQL to Phoenix before product routes', () => {
      const target = resolve(
        '/api/graphql',
        'dashboard.groupher.localhost',
        '?query=%7Bme%7Blogin%7D%7D',
        undefined,
        'POST',
      )

      expect(target.targetKind).toBe('phoenix')
      expect(target.targetUrl.origin).toBe(new URL(SITE.API).origin)
      expect(target.targetUrl.pathname).toBe('/graphiql')
      expect(target.targetUrl.search).toBe('?query=%7Bme%7Blogin%7D%7D')
      expect(target.requestHeaderPolicy).toBe('graphql-browser-clean')
      expect(target.requiresBodyProxy).toBe(true)
    })

    it('routes explicit Main and Landing subdomains before canonical path rules', () => {
      expect(resolve('/', 'main.groupher.localhost').targetKind).toBe('main')
      expect(resolve('/unknown', 'landing.groupher.localhost').targetKind).toBe('landing')
    })

    it('rewrites dashboard route to dashboard site and trims /dashboard suffix', () => {
      const target = resolve('/cps/dashboard', 'www.groupher.com', '?page=1')
      expect(target.targetKind).toBe('dashboard')
      expect(target.targetUrl.pathname).toBe('/cps')
      expect(target.targetUrl.search).toBe('?page=1')
    })

    it('rewrites nested dashboard route and keeps real route segments', () => {
      const target = resolve('/cps/dashboard/appearance/kanban', 'www.groupher.com', '?tab=preview')
      expect(target.targetKind).toBe('dashboard')
      expect(target.targetUrl.pathname).toBe('/cps/appearance/kanban')
      expect(target.targetUrl.search).toBe('?tab=preview')
    })

    it('keeps nested dashboard route on dashboard subdomain', () => {
      const target = resolve('/cps/appearance/kanban', 'dashboard.groupher.com', '?tab=preview')
      expect(target.targetKind).toBe('dashboard')
      expect(target.targetUrl.pathname).toBe('/cps/appearance/kanban')
      expect(target.targetUrl.search).toBe('?tab=preview')
    })

    it('uses the original Portless host instead of the Gateway listener host', () => {
      const target = resolve(
        '/home/dashboard',
        '127.0.0.1:3003',
        '',
        'dashboard.groupher.localhost',
      )
      expect(target.targetKind).toBe('dashboard')
      expect(target.targetUrl.pathname).toBe('/home/dashboard')
    })

    it('routes static assets to the owning sub-application', () => {
      expect(resolve('/dashboard/_next/static/chunks/app.js', 'www.groupher.com').targetKind).toBe(
        'dashboard',
      )
      expect(resolve('/landing/_next/static/chunks/app.js', 'www.groupher.com').targetKind).toBe(
        'landing',
      )
    })

    it('routes unprefixed development chunks by the dashboard referer', () => {
      const target = resolve(
        '/_next/static/chunks/app.js',
        'groupher.localhost',
        '',
        undefined,
        'GET',
        'https://groupher.localhost/home/dashboard/appearance',
      )

      expect(target.targetKind).toBe('dashboard')
      expect(target.targetUrl.pathname).toBe('/_next/static/chunks/app.js')
    })

    it('routes unprefixed development chunks by the landing referer', () => {
      const target = resolve(
        '/_next/static/chunks/app.js',
        'groupher.localhost',
        '',
        undefined,
        'GET',
        'https://groupher.localhost/pricing',
      )

      expect(target.targetKind).toBe('landing')
      expect(target.targetUrl.pathname).toBe('/_next/static/chunks/app.js')
    })

    it('routes landing static page paths to landing', () => {
      const target = resolve('/pricing', 'www.groupher.com', '?ref=ad')
      expect(target.targetKind).toBe('landing')
      expect(target.targetUrl.pathname).toBe('/pricing')
      expect(target.targetUrl.search).toBe('?ref=ad')
    })

    it('rewrites other routes to main site', () => {
      const target = resolve('/unknown', 'www.groupher.com', '?k=v')
      expect(target.targetKind).toBe('main')
      expect(target.targetUrl.pathname).toBe('/unknown')
      expect(target.targetUrl.search).toBe('?k=v')
    })

    it('does not misclassify non-dashboard routes', () => {
      const target = resolve('/foo/bar/dashboard', 'www.groupher.com', '?k=v')
      expect(target.targetKind).toBe('main')
      expect(target.targetUrl.pathname).toBe('/foo/bar/dashboard')
      expect(target.targetUrl.search).toBe('?k=v')
    })
  })
})
