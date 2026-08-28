import { describe, expect, it } from 'vitest'

import {
  getDashUrl,
  isApplyHost,
  isApplyRoute,
  isAuthRoute,
  isDashHost,
  isDashRoute,
  isGraphqlRoute,
  isLandingHost,
  isLandingStaticRoute,
  isPlatformRootHost,
  isPressRoute,
  resolveGatewayTarget,
  SITE,
} from './routing'

describe('dev-gateway/routing', () => {
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

  it('recognizes only surviving product subdomains', () => {
    expect(isLandingHost('landing.groupher.localhost')).toBe(true)
    expect(isDashHost('dash.groupher.localhost')).toBe(true)
    expect(isApplyHost('apply.groupher.localhost')).toBe(true)
    expect(isLandingHost('retired.groupher.localhost')).toBe(false)
    expect(isDashHost('community.groupher.localhost')).toBe(false)
  })

  it('keeps public route predicates at the dev boundary', () => {
    expect(isAuthRoute('/api/auth/callback/github')).toBe(true)
    expect(isGraphqlRoute('/api/graphql')).toBe(true)
    expect(isPressRoute('/home/post/1.md')).toBe(true)
    expect(isPlatformRootHost('groupher.localhost')).toBe(true)
    expect(isPlatformRootHost('docs.example.com')).toBe(false)
  })

  it('keeps only Landing static assets as a named static product route', () => {
    expect(isLandingStaticRoute('/landing/assets/app.js')).toBe(true)
    expect(isLandingStaticRoute('/dashboard/assets/app.js')).toBe(false)
  })

  it('preserves Dash paths and search on its dedicated host', () => {
    expect(isDashRoute('/home/overview', 'dash.groupher.com')).toBe(true)
    expect(isApplyRoute('/review/app_1', 'apply.groupher.com')).toBe(true)

    const url = getDashUrl('/home/overview', 'dash.groupher.com', '?tab=a')
    expect(url.origin).toBe(new URL(SITE.DASH).origin)
    expect(url.pathname).toBe('/home/overview')
    expect(url.search).toBe('?tab=a')
  })

  it('routes public Landing, Community, Auth and GraphQL requests through the shared contract', () => {
    expect(resolve('/', 'groupher.localhost').targetKind).toBe('landing')
    expect(resolve('/pricing', 'groupher.localhost').targetKind).toBe('landing')
    expect(resolve('/home', 'groupher.localhost').targetKind).toBe('community')
    expect(resolve('/api/auth/providers', 'groupher.localhost').targetKind).toBe('auth')

    const graphql = resolve('/api/graphql', 'groupher.localhost', '', undefined, 'POST')
    expect(graphql.targetKind).toBe('phoenix')
    expect(graphql.targetUrl.pathname).toBe('/graphiql')
  })

  it('routes surviving dedicated product hosts directly', () => {
    expect(resolve('/home/overview', 'dash.groupher.localhost').targetKind).toBe('dash')
    expect(resolve('/review', 'apply.groupher.localhost').targetKind).toBe('apply')
    expect(resolve('/pricing', 'landing.groupher.localhost').targetKind).toBe('landing')
    expect(resolve('/home', 'community.groupher.localhost').targetKind).toBe('community')
  })

  it('routes TanStack development assets and server functions using the originating host', () => {
    expect(
      resolve(
        '/@id/virtual:tanstack-start-dev-client-entry',
        'groupher.localhost',
        '',
        undefined,
        'GET',
        'https://dash.groupher.localhost/home/overview',
      ).targetKind,
    ).toBe('dash')

    expect(
      resolve(
        '/_serverFn/loadCommunity',
        'groupher.localhost',
        '',
        undefined,
        'GET',
        'https://apply.groupher.localhost/review',
      ).targetKind,
    ).toBe('apply')

    expect(
      resolve(
        '/icons/groupher.svg',
        'groupher.localhost',
        '',
        undefined,
        'GET',
        'https://landing.groupher.localhost/pricing',
      ).targetKind,
    ).toBe('landing')
  })
})
