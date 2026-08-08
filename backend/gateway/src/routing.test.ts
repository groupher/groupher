import { describe, expect, it } from 'vitest'

import {
  getDashboardUrl,
  getDashUrl,
  isAuthRoute,
  isDashHost,
  isDashRoute,
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
      expect(isDashHost('dash.groupher.localhost')).toBe(true)
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

  describe('isDashRoute', () => {
    it('returns true for dash subdomain', () => {
      expect(isDashRoute('/home/overview', 'dash.groupher.com')).toBe(true)
    })

    it('returns true for /xxx/dash pattern', () => {
      expect(isDashRoute('/home/dash', 'www.groupher.com')).toBe(true)
      expect(isDashRoute('/home/dash/overview', 'www.groupher.com')).toBe(true)
    })

    it('returns false for non-dash route', () => {
      expect(isDashRoute('/organizations/settings/dash', 'www.groupher.com')).toBe(false)
      expect(isDashRoute('/foo/bar/dash', 'www.groupher.com')).toBe(false)
      expect(isDashRoute('/home/dashboard', 'www.groupher.com')).toBe(false)
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

  describe('getDashUrl', () => {
    it('keeps pathname/search for dash subdomain', () => {
      const url = getDashUrl('/home/overview', 'dash.groupher.com', '?tab=a')
      expect(url.origin).toBe(new URL(SITE.DASH).origin)
      expect(url.pathname).toBe('/home/overview')
      expect(url.search).toBe('?tab=a')
    })

    it('preserves the public /xxx/dash path', () => {
      const url = getDashUrl('/home/dash', 'www.groupher.com', '?page=2')
      expect(url.origin).toBe(new URL(SITE.DASH).origin)
      expect(url.pathname).toBe('/home/dash')
      expect(url.search).toBe('?page=2')
    })

    it('preserves nested public dash route segments', () => {
      const url = getDashUrl('/home/dash/overview', 'www.groupher.com', '?tab=preview')
      expect(url.origin).toBe(new URL(SITE.DASH).origin)
      expect(url.pathname).toBe('/home/dash/overview')
      expect(url.search).toBe('?tab=preview')
    })
  })

  describe('getDashboardUrl', () => {
    it('keeps pathname/search for dashboard subdomain', () => {
      const url = getDashboardUrl('/cps', 'dashboard.groupher.com', '?page=1&tab=a')
      expect(url.origin).toBe(new URL(SITE.DASHBOARD).origin)
      expect(url.pathname).toBe('/cps')
      expect(url.search).toBe('?page=1&tab=a')
    })

    it('preserves the canonical /xxx/dashboard route', () => {
      const url = getDashboardUrl('/cps/dashboard', 'www.groupher.com', '?page=2')
      expect(url.origin).toBe(new URL(SITE.DASHBOARD).origin)
      expect(url.pathname).toBe('/cps/dashboard')
      expect(url.search).toBe('?page=2')
    })

    it('keeps nested dashboard route segments', () => {
      const url = getDashboardUrl(
        '/cps/dashboard/appearance/kanban',
        'www.groupher.com',
        '?tab=preview',
      )
      expect(url.origin).toBe(new URL(SITE.DASHBOARD).origin)
      expect(url.pathname).toBe('/cps/dashboard/appearance/kanban')
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

    it('preserves unexpected paths for the dashboard app to handle', () => {
      const url = getDashboardUrl('/dashboard', 'www.groupher.com', '')
      expect(url.origin).toBe(new URL(SITE.DASHBOARD).origin)
      expect(url.pathname).toBe('/dashboard')
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
      expect(resolve('/home/overview', 'dash.groupher.localhost').targetKind).toBe('dash')
    })

    it('routes the canonical dashboard path to the dashboard app unchanged', () => {
      const target = resolve('/cps/dashboard', 'www.groupher.com', '?page=1')
      expect(target.targetKind).toBe('dashboard')
      expect(target.targetUrl.pathname).toBe('/cps/dashboard')
      expect(target.targetUrl.search).toBe('?page=1')
    })

    it('routes dash route to dash site with its public path intact', () => {
      const target = resolve('/home/dash', 'www.groupher.com', '?page=1')
      expect(target.targetKind).toBe('dash')
      expect(target.targetUrl.pathname).toBe('/home/dash')
      expect(target.targetUrl.search).toBe('?page=1')
    })

    it('routes nested dash route with its public path intact', () => {
      const target = resolve('/home/dash/overview', 'www.groupher.com', '?tab=preview')
      expect(target.targetKind).toBe('dash')
      expect(target.targetUrl.pathname).toBe('/home/dash/overview')
      expect(target.targetUrl.search).toBe('?tab=preview')
    })

    it('rewrites nested dashboard route and keeps real route segments', () => {
      const target = resolve('/cps/dashboard/appearance/kanban', 'www.groupher.com', '?tab=preview')
      expect(target.targetKind).toBe('dashboard')
      expect(target.targetUrl.pathname).toBe('/cps/dashboard/appearance/kanban')
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

    it('uses the original Portless host for dash requests', () => {
      const target = resolve('/home/overview', '127.0.0.1:3003', '', 'dash.groupher.localhost')
      expect(target.targetKind).toBe('dash')
      expect(target.targetUrl.pathname).toBe('/home/overview')
    })

    it('routes static assets to the owning sub-application', () => {
      expect(resolve('/dashboard/_next/static/chunks/app.js', 'www.groupher.com').targetKind).toBe(
        'dashboard',
      )
      expect(resolve('/landing/_next/static/chunks/app.js', 'www.groupher.com').targetKind).toBe(
        'landing',
      )
    })

    it('routes namespaced Dashboard HMR to Dashboard without a referer', () => {
      const target = resolve('/dashboard/_next/hmr', 'groupher.localhost', '?id=dev')

      expect(target.targetKind).toBe('dashboard')
      expect(target.targetUrl.pathname).toBe('/dashboard/_next/hmr')
      expect(target.targetUrl.search).toBe('?id=dev')
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

    it('routes unprefixed development chunks by the dash referer', () => {
      const target = resolve(
        '/_vite/client',
        'groupher.localhost',
        '',
        undefined,
        'GET',
        'https://groupher.localhost/home/dash/overview',
      )

      expect(target.targetKind).toBe('dash')
      expect(target.targetUrl.pathname).toBe('/_vite/client')
    })

    it('routes Dash Vite development assets without requiring a page referer', () => {
      const moduleTarget = resolve(
        '/@id/virtual:tanstack-start-dev-client-entry',
        'groupher.localhost',
        '',
        undefined,
      )
      const stylesheetTarget = resolve(
        '/@tanstack-start/styles.css',
        'groupher.localhost',
        '?routes=__root__',
        undefined,
      )
      const refreshTarget = resolve('/@react-refresh', 'groupher.localhost', '', undefined)
      const fsTarget = resolve(
        '/@fs/Users/xieyiming/code/groupher/groupher/node_modules/vite/dist/client/env.mjs',
        'groupher.localhost',
        '',
        undefined,
      )
      const dependencyTarget = resolve(
        '/node_modules/.vite/deps/react.js',
        'groupher.localhost',
        '',
        undefined,
      )
      const hmrTarget = resolve('/__dash_hmr', 'groupher.localhost', '', undefined)
      const sourceTarget = resolve('/src/router.tsx', 'groupher.localhost', '', undefined)

      expect(moduleTarget.targetKind).toBe('dash')
      expect(moduleTarget.targetUrl.pathname).toBe('/@id/virtual:tanstack-start-dev-client-entry')
      expect(stylesheetTarget.targetKind).toBe('dash')
      expect(stylesheetTarget.targetUrl.pathname).toBe('/@tanstack-start/styles.css')
      expect(stylesheetTarget.targetUrl.search).toBe('?routes=__root__')
      expect(refreshTarget.targetKind).toBe('dash')
      expect(refreshTarget.targetUrl.pathname).toBe('/@react-refresh')
      expect(fsTarget.targetKind).toBe('dash')
      expect(fsTarget.targetUrl.pathname).toBe(
        '/@fs/Users/xieyiming/code/groupher/groupher/node_modules/vite/dist/client/env.mjs',
      )
      expect(dependencyTarget.targetKind).toBe('dash')
      expect(dependencyTarget.targetUrl.pathname).toBe('/node_modules/.vite/deps/react.js')
      expect(hmrTarget.targetKind).toBe('dash')
      expect(hmrTarget.targetUrl.pathname).toBe('/__dash_hmr')
      expect(sourceTarget.targetKind).toBe('dash')
      expect(sourceTarget.targetUrl.pathname).toBe('/src/router.tsx')
    })

    it('routes shared core static assets by the dash page referer', () => {
      const wallpaperTarget = resolve(
        '/wallpaper/picture/travel.webp',
        'groupher.localhost',
        '',
        undefined,
        'GET',
        'https://groupher.localhost/home/dash/overview',
      )
      const iconTarget = resolve(
        '/icons/lucide/tag.svg',
        'groupher.localhost',
        '',
        undefined,
        'GET',
        'https://groupher.localhost/home/dash/appearance',
      )

      expect(wallpaperTarget.targetKind).toBe('dash')
      expect(wallpaperTarget.targetUrl.pathname).toBe('/wallpaper/picture/travel.webp')
      expect(iconTarget.targetKind).toBe('dash')
      expect(iconTarget.targetUrl.pathname).toBe('/icons/lucide/tag.svg')
    })

    it('routes unprefixed app assets by the dash page referer', () => {
      const avatarTarget = resolve(
        '/avatars/2-purple.png',
        'groupher.localhost',
        '',
        undefined,
        'GET',
        'https://groupher.localhost/home/dash/post/content',
      )

      expect(avatarTarget.targetKind).toBe('dash')
      expect(avatarTarget.targetUrl.pathname).toBe('/avatars/2-purple.png')
    })

    it('routes TanStack server functions by the dash page referer', () => {
      const target = resolve(
        '/_serverFn/load-paged-posts',
        'groupher.localhost',
        '?payload=encoded',
        undefined,
        'GET',
        'https://groupher.localhost/home/dash/post/content',
      )

      expect(target.targetKind).toBe('dash')
      expect(target.targetUrl.pathname).toBe('/_serverFn/load-paged-posts')
      expect(target.targetUrl.search).toBe('?payload=encoded')
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
