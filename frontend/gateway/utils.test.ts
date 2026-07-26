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
  SITE,
} from './utils'

describe('gateway/utils', () => {
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
})
