import { describe, expect, it } from 'vitest'

import { isValidCommunitySlug, resolvePublicRoute } from './index'

const resolveRoot = (pathname: string) => resolvePublicRoute({ hostname: 'groupher.com', pathname })

describe('community slug contract', () => {
  it.each(['home', 'web-dev', 'a1', 'a-b2'])('accepts %s', (slug) => {
    expect(isValidCommunitySlug(slug)).toBe(true)
  })

  it.each(['Home', '1home', '-home', 'home-', 'home--dev', 'a'.repeat(31)])(
    'rejects %s',
    (slug) => {
      expect(isValidCommunitySlug(slug)).toBe(false)
    },
  )
})

describe('platform root routes', () => {
  it.each(['/', '/pricing', '/pricing/', '/book-demo'])('routes Landing page %s', (pathname) => {
    expect(resolveRoot(pathname).targetKind).toBe('landing')
  })

  it.each([
    '/sitemap.xml',
    '/llms.txt',
    '/robots.txt',
    '/favicon.ico',
    '/landing/assets/app.js',
    '/icons/logo.svg',
  ])('routes Landing asset %s', (pathname) => {
    expect(resolveRoot(pathname).targetKind).toBe('landing')
  })

  it('maps the public Landing asset namespace to the static bundle path', () => {
    expect(resolveRoot('/landing/assets/app.js')).toMatchObject({
      targetKind: 'landing',
      pathname: '/assets/app.js',
    })
  })

  it('keeps health isolated to the router', () => {
    expect(resolveRoot('/health').targetKind).toBe('health')
    expect(resolveRoot('/health/dash').targetKind).toBe('not-found')
    expect(
      resolvePublicRoute({ hostname: 'groupher.com', pathname: '/health', method: 'POST' })
        .targetKind,
    ).toBe('not-found')
  })

  it.each(['/api/auth', '/api/auth/session'])('routes Auth %s', (pathname) => {
    expect(resolveRoot(pathname).targetKind).toBe('auth')
  })

  it('rewrites browser GraphQL to Phoenix graphiql', () => {
    expect(resolveRoot('/api/graphql')).toEqual({
      routeClass: 'phoenix',
      targetKind: 'phoenix',
      pathname: '/graphiql',
      requestHeaderPolicy: 'graphql-browser-clean',
    })
  })

  it('keeps slugify in Community', () => {
    expect(resolveRoot('/api/utils/slugify').targetKind).toBe('community')
  })

  it.each([
    '/home/post/a.md',
    '/home/doc/xyz/123.md',
    '/home/feed.xml',
    '/home/blog/feed.xml',
    '/home/llms.txt',
  ])('routes Press output %s', (pathname) => {
    expect(resolveRoot(pathname)).toMatchObject({
      targetKind: 'press',
      requestHeaderPolicy: 'public-output',
    })
  })

  it.each([
    '/home/dashboard',
    '/home/dashboard/settings',
    '/home/dash/overview',
    '/apply',
    '/apply/start',
    '/api/artiment/post',
    '/api/docs/import/start',
    '/api/internal/docs-import/status',
    '/api/revalidate/community',
    '/dashboard/_next/app.js',
    '/api/unknown',
  ])('keeps removed or unknown route %s at 404', (pathname) => {
    expect(resolveRoot(pathname).targetKind).toBe('not-found')
  })

  it('routes a valid first segment to Community', () => {
    expect(resolveRoot('/home/post/123')).toEqual({
      routeClass: 'community',
      targetKind: 'community',
      pathname: '/home/post/123',
      requestHeaderPolicy: 'pass-through',
      communitySlug: 'home',
    })
  })

  it.each(['/Home', '/1home', '/_next/app.js'])('rejects invalid first segment %s', (pathname) => {
    expect(resolveRoot(pathname).targetKind).toBe('not-found')
  })
})

describe('custom community domains', () => {
  const resolveCustom = (pathname: string) =>
    resolvePublicRoute({
      hostname: 'talk.example.com',
      pathname,
      customDomainCommunities: { 'talk.example.com': 'home' },
    })

  it.each([
    ['/', '/home'],
    ['/post/123', '/home/post/123'],
    ['/api/graphql', '/home/api/graphql'],
  ])('routes %s to Community as %s', (pathname, internalPath) => {
    expect(resolveCustom(pathname)).toEqual({
      routeClass: 'community',
      targetKind: 'community',
      pathname: internalPath,
      requestHeaderPolicy: 'pass-through',
      communitySlug: 'home',
    })
  })

  it('keeps the Community-owned slugify API at its root route', () => {
    expect(resolveCustom('/api/utils/slugify')).toEqual({
      routeClass: 'custom-community-tool',
      targetKind: 'community',
      pathname: '/api/utils/slugify',
      requestHeaderPolicy: 'pass-through',
      communitySlug: 'home',
    })
  })

  it.each([
    ['/feed.xml', '/home/feed.xml'],
    ['/post/a.md', '/home/post/a.md'],
    ['/doc/xyz/123.md', '/home/doc/xyz/123.md'],
  ])('routes %s to Press as %s', (pathname, internalPath) => {
    expect(resolveCustom(pathname)).toEqual({
      routeClass: 'press',
      targetKind: 'press',
      pathname: internalPath,
      requestHeaderPolicy: 'public-output',
      communitySlug: 'home',
    })
  })

  it('rejects unknown hosts and invalid mapped slugs', () => {
    expect(resolvePublicRoute({ hostname: 'unknown.example.com', pathname: '/' }).targetKind).toBe(
      'not-found',
    )
    expect(
      resolvePublicRoute({
        hostname: 'talk.example.com',
        pathname: '/',
        customDomainCommunities: { 'talk.example.com': 'Invalid' },
      }).targetKind,
    ).toBe('not-found')
  })
})
