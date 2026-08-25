import { describe, expect, it } from 'vitest'

import {
  getDashboardUrl,
  getDashUrl,
  isAuthRoute,
  isApplyHost,
  isApplyRoute,
  isDashHost,
  isDashRoute,
  isDashboardRoute,
  isDashboardStaticRoute,
  isGraphqlRoute,
  isLandingHost,
  isLandingStaticRoute,
  isMainHost,
  isPlatformRootHost,
  isPressRoute,
  resolveGatewayTarget,
  SITE,
} from './routing'

describe('gateway/routing', () => {
  describe('isAuthRoute', () => {
    it('only matches the Auth.js route namespace', () => {
      expect(isAuthRoute('/api/auth')).toBe(true)
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
      expect(isApplyHost('apply.groupher.localhost')).toBe(true)
    })
  })

  describe('isApplyRoute', () => {
    it('recognizes only the independent Apply host', () => {
      expect(isApplyRoute('/apply', 'groupher.com')).toBe(false)
      expect(isApplyRoute('/apply/review/app_1', 'groupher.com')).toBe(false)
      expect(isApplyRoute('/anything', 'apply.groupher.localhost')).toBe(true)
      expect(isApplyRoute('/home/dash/apply', 'groupher.com')).toBe(false)
    })
  })

  describe('isDashboardRoute', () => {
    it('returns true for dashboard subdomain', () => {
      expect(isDashboardRoute('/cps', 'dashboard.groupher.com')).toBe(true)
    })

    it('does not recognize removed root-domain dashboard paths', () => {
      expect(isDashboardRoute('/cps/dashboard', 'www.groupher.com')).toBe(false)
      expect(isDashboardRoute('/cps/dashboard/appearance', 'www.groupher.com')).toBe(false)
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

    it('does not recognize removed root-domain Dash paths', () => {
      expect(isDashRoute('/home/dash', 'www.groupher.com')).toBe(false)
      expect(isDashRoute('/home/dash/overview', 'www.groupher.com')).toBe(false)
    })

    it('returns false for non-dash route', () => {
      expect(isDashRoute('/organizations/settings/dash', 'www.groupher.com')).toBe(false)
      expect(isDashRoute('/foo/bar/dash', 'www.groupher.com')).toBe(false)
      expect(isDashRoute('/home/dashboard', 'www.groupher.com')).toBe(false)
    })
  })

  describe('static route predicates', () => {
    it('keeps platform root files separate from custom domains', () => {
      expect(isPlatformRootHost('groupher.com')).toBe(true)
      expect(isPlatformRootHost('docs.example.com')).toBe(false)
      expect(isPressRoute('/home/post/1.md')).toBe(true)
      expect(isPressRoute('/home/sitemap.xml')).toBe(true)
    })
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

    it('preserves canonical Dash paths', () => {
      const url = getDashUrl('/home/overview', 'dash.groupher.com', '?page=2')
      expect(url.origin).toBe(new URL(SITE.DASH).origin)
      expect(url.pathname).toBe('/home/overview')
      expect(url.search).toBe('?page=2')
    })

    it('preserves nested public dash route segments', () => {
      const url = getDashUrl('/home/appearance', 'dash.groupher.com', '?tab=preview')
      expect(url.origin).toBe(new URL(SITE.DASH).origin)
      expect(url.pathname).toBe('/home/appearance')
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

    it('preserves canonical Dashboard paths', () => {
      const url = getDashboardUrl('/cps/appearance', 'dashboard.groupher.com', '?page=2')
      expect(url.origin).toBe(new URL(SITE.DASHBOARD).origin)
      expect(url.pathname).toBe('/cps/appearance')
      expect(url.search).toBe('?page=2')
    })

    it('keeps nested dashboard route segments', () => {
      const url = getDashboardUrl(
        '/cps/appearance/kanban',
        'dashboard.groupher.com',
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

    it('preserves unexpected paths for the dashboard app to handle', () => {
      const url = getDashboardUrl('/cps', 'dashboard.groupher.com', '')
      expect(url.origin).toBe(new URL(SITE.DASHBOARD).origin)
      expect(url.pathname).toBe('/cps')
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

    it('routes root-domain browser GraphQL to Phoenix', () => {
      const target = resolve(
        '/api/graphql',
        'groupher.localhost',
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

    it('routes community Press outputs before Main', () => {
      expect(resolve('/home/post/1.md', 'groupher.com').targetKind).toBe('press')
      expect(resolve('/home/feed.xml', 'groupher.com').targetKind).toBe('press')
      expect(resolve('/home/llms.txt', 'groupher.com').targetKind).toBe('press')
    })

    it('injects community scope for custom-domain Press routes', () => {
      process.env.CUSTOM_DOMAIN_COMMUNITIES = JSON.stringify({ 'docs.example.com': 'home' })

      expect(resolve('/post/feed.xml', 'docs.example.com').targetUrl.pathname).toBe(
        '/home/post/feed.xml',
      )
      expect(resolve('/doc/8/start.md', 'docs.example.com').targetUrl.pathname).toBe(
        '/home/doc/8/start.md',
      )

      delete process.env.CUSTOM_DOMAIN_COMMUNITIES
    })

    it('injects community scope for custom-domain Community routes', () => {
      process.env.CUSTOM_DOMAIN_COMMUNITIES = JSON.stringify({ 'talk.example.com': 'home' })

      const page = resolve('/post/123', 'talk.example.com')
      expect(page.targetKind).toBe('community')
      expect(page.targetUrl.pathname).toBe('/home/post/123')
      expect(page.communitySlug).toBe('home')

      const slugify = resolve('/api/utils/slugify', 'talk.example.com')
      expect(slugify.targetKind).toBe('community')
      expect(slugify.targetUrl.pathname).toBe('/api/utils/slugify')

      delete process.env.CUSTOM_DOMAIN_COMMUNITIES
    })

    it('routes explicit Main and Landing subdomains before canonical path rules', () => {
      expect(resolve('/', 'main.groupher.localhost').targetKind).toBe('main')
      expect(resolve('/unknown', 'landing.groupher.localhost').targetKind).toBe('landing')
      expect(resolve('/home/overview', 'dash.groupher.localhost').targetKind).toBe('dash')
    })

    it('routes Apply only through its independent host', () => {
      const target = resolve('/review/app_1', 'apply.groupher.localhost', '?tab=events')
      expect(target.targetKind).toBe('apply')
      expect(target.targetUrl.origin).toBe(new URL(SITE.APPLY).origin)
      expect(target.targetUrl.pathname).toBe('/review/app_1')
      expect(target.targetUrl.search).toBe('?tab=events')
      expect(resolve('/apply/review/app_1', 'groupher.com').targetKind).toBe('not-found')
    })

    it('routes shared Vite modules by the Apply page referer', () => {
      const target = resolve(
        '/@tanstack-start/styles.css',
        'groupher.localhost',
        '',
        undefined,
        'GET',
        'https://apply.groupher.localhost/',
      )
      expect(target.targetKind).toBe('apply')
      expect(target.targetUrl.pathname).toBe('/@tanstack-start/styles.css')
    })

    it('returns 404 for removed root-domain dashboard paths', () => {
      const target = resolve('/cps/dashboard', 'www.groupher.com', '?page=1')
      expect(target.targetKind).toBe('not-found')
    })

    it('returns 404 for removed root-domain Dash paths', () => {
      const target = resolve('/home/dash', 'www.groupher.com', '?page=1')
      expect(target.targetKind).toBe('not-found')
    })

    it('returns 404 for nested removed root-domain Dash paths', () => {
      const target = resolve('/home/dash/overview', 'www.groupher.com', '?tab=preview')
      expect(target.targetKind).toBe('not-found')
    })

    it('returns 404 for nested removed root-domain dashboard paths', () => {
      const target = resolve('/cps/dashboard/appearance/kanban', 'www.groupher.com', '?tab=preview')
      expect(target.targetKind).toBe('not-found')
    })

    it('keeps nested dashboard route on dashboard subdomain', () => {
      const target = resolve('/cps/appearance/kanban', 'dashboard.groupher.com', '?tab=preview')
      expect(target.targetKind).toBe('dashboard')
      expect(target.targetUrl.pathname).toBe('/cps/appearance/kanban')
      expect(target.targetUrl.search).toBe('?tab=preview')
    })

    it('uses the original Portless host instead of the Gateway listener host', () => {
      const target = resolve('/home', '127.0.0.1:3003', '', 'dashboard.groupher.localhost')
      expect(target.targetKind).toBe('dashboard')
      expect(target.targetUrl.pathname).toBe('/home')
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
        'https://dashboard.groupher.localhost/home/appearance',
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
        'https://dash.groupher.localhost/home/overview',
      )

      expect(target.targetKind).toBe('dash')
      expect(target.targetUrl.pathname).toBe('/_vite/client')
    })

    it('routes shared Vite development assets using the Dash page referer', () => {
      const dashReferer = 'https://dash.groupher.localhost/home/overview'
      const moduleTarget = resolve(
        '/@id/virtual:tanstack-start-dev-client-entry',
        'groupher.localhost',
        '',
        undefined,
        'GET',
        dashReferer,
      )
      const stylesheetTarget = resolve(
        '/@tanstack-start/styles.css',
        'groupher.localhost',
        '?routes=__root__',
        undefined,
        'GET',
        dashReferer,
      )
      const refreshTarget = resolve(
        '/@react-refresh',
        'groupher.localhost',
        '',
        undefined,
        'GET',
        dashReferer,
      )
      const fsTarget = resolve(
        '/@fs/Users/xieyiming/code/groupher/groupher/node_modules/vite/dist/client/env.mjs',
        'groupher.localhost',
        '',
        undefined,
        'GET',
        dashReferer,
      )
      const dependencyTarget = resolve(
        '/node_modules/.vite/deps/react.js',
        'groupher.localhost',
        '',
        undefined,
        'GET',
        dashReferer,
      )
      const hmrTarget = resolve('/__dash_hmr', 'groupher.localhost', '', undefined)
      const sourceTarget = resolve(
        '/src/router.tsx',
        'groupher.localhost',
        '',
        undefined,
        'GET',
        dashReferer,
      )

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

    it('routes root Dash Vite assets after the virtual client entry becomes the referer', () => {
      const virtualClientReferer =
        'https://groupher.localhost/@id/virtual:tanstack-start-dev-client-entry'
      const target = resolve(
        '/@react-refresh',
        'groupher.localhost',
        '',
        undefined,
        'GET',
        virtualClientReferer,
      )

      expect(target.targetKind).toBe('dash')
      expect(target.targetUrl.pathname).toBe('/@react-refresh')
    })

    it('keeps chained Dash Vite modules on Dash after the referer becomes an fs module', () => {
      const moduleReferer =
        'https://groupher.localhost/@fs/Users/xieyiming/code/groupher/groupher/node_modules/@tanstack/react-start/dist/plugin/default-entry/client.tsx'
      const target = resolve(
        '/@fs/Users/xieyiming/code/groupher/groupher/frontend/core/ui/Switcher/Tabs/DesktopView.tsx',
        'groupher.localhost',
        '',
        undefined,
        'GET',
        moduleReferer,
      )

      expect(target.targetKind).toBe('dash')
      expect(target.targetUrl.pathname).toBe(
        '/@fs/Users/xieyiming/code/groupher/groupher/frontend/core/ui/Switcher/Tabs/DesktopView.tsx',
      )
    })

    it('keeps Dash Vite modules on Dash through the refresh and source chain', () => {
      const refreshTarget = resolve(
        '/@vite/client',
        'groupher.localhost',
        '',
        undefined,
        'GET',
        'https://groupher.localhost/@react-refresh',
      )
      const sourceTarget = resolve(
        '/src/routeTree.gen.ts',
        'groupher.localhost',
        '',
        undefined,
        'GET',
        'https://groupher.localhost/src/router.tsx',
      )

      expect(refreshTarget.targetKind).toBe('dash')
      expect(sourceTarget.targetKind).toBe('dash')
    })

    it('routes shared core static assets by the dash page referer', () => {
      const wallpaperTarget = resolve(
        '/wallpaper/picture/travel.webp',
        'groupher.localhost',
        '',
        undefined,
        'GET',
        'https://dash.groupher.localhost/home/overview',
      )
      const iconTarget = resolve(
        '/icons/lucide/tag.svg',
        'groupher.localhost',
        '',
        undefined,
        'GET',
        'https://dash.groupher.localhost/home/appearance',
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
        'https://dash.groupher.localhost/home/post/content',
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
        'https://dash.groupher.localhost/home/post/content',
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

    it('routes valid root segments to Community', () => {
      const target = resolve('/unknown', 'www.groupher.com', '?k=v')
      expect(target.targetKind).toBe('community')
      expect(target.targetUrl.pathname).toBe('/unknown')
      expect(target.targetUrl.search).toBe('?k=v')
    })

    it('does not misclassify non-dashboard routes', () => {
      const target = resolve('/foo/bar/dashboard', 'www.groupher.com', '?k=v')
      expect(target.targetKind).toBe('community')
      expect(target.targetUrl.pathname).toBe('/foo/bar/dashboard')
      expect(target.targetUrl.search).toBe('?k=v')
    })
  })
})
