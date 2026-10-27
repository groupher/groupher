export type RouteTargetKind =
  | 'health'
  | 'landing'
  | 'community'
  | 'auth'
  | 'phoenix'
  | 'press'
  | 'not-found'

export type RequestHeaderPolicy = 'pass-through' | 'graphql-browser-clean' | 'public-output'

export type PublicRoute = {
  routeClass: string
  targetKind: RouteTargetKind
  pathname: string
  requestHeaderPolicy: RequestHeaderPolicy
  communitySlug?: string
}

export type ResolvePublicRouteInput = {
  hostname: string
  pathname: string
  method?: string
  customDomainCommunities?: Readonly<Record<string, string>>
  platformHosts?: readonly string[]
}

export const PRODUCTION_PLATFORM_HOSTS = ['groupher.com', 'www.groupher.com'] as const
export const PLATFORM_ROOT_HOSTS = [
  ...PRODUCTION_PLATFORM_HOSTS,
  'groupher.localhost',
  'www.groupher.localhost',
  'localhost',
  '127.0.0.1',
] as const
export const PLATFORM_HOSTS = [...PLATFORM_ROOT_HOSTS, 'community.groupher.localhost'] as const

/** Identifies a Groupher-owned host rather than a custom community domain. */
export const isPlatformHost = (hostname: string): boolean =>
  (PLATFORM_HOSTS as readonly string[]).includes(hostname.split(':')[0].toLowerCase())

/** Public API paths shared by frontend transports and platform routing. */
export const API_ROUTE = {
  AUTH: '/api/auth',
  GRAPHQL: '/api/graphql',
  ARTIMENT_IMPORT: '/api/artiment/import',
  CONTENT_PUBLISH: '/api/content/publish',
  SLUGIFY: '/api/utils/slugify',
} as const

/** Auth service routes shared by the service and browser clients. */
export const AUTH_ROUTE = {
  ROOT: API_ROUTE.AUTH,
  WILDCARD: `${API_ROUTE.AUTH}/*`,
  SESSION: `${API_ROUTE.AUTH}/session`,
  TOKEN_REFRESH: `${API_ROUTE.AUTH}/token/refresh`,
  SESSIONS: `${API_ROUTE.AUTH}/sessions`,
  SESSION_REVOKE_OTHERS: `${API_ROUTE.AUTH}/sessions/revoke-others`,
  LOGOUT: `${API_ROUTE.AUTH}/logout`,
  TEST_LOGIN: `${API_ROUTE.AUTH}/test-login`,
  ACCOUNTS: `${API_ROUTE.AUTH}/accounts`,
  ACCOUNT_LINK: `${API_ROUTE.AUTH}/accounts/:provider/link`,
  ACCOUNT_CALLBACK: `${API_ROUTE.AUTH}/accounts/:provider/callback`,
  ACCOUNT_UNLINK: `${API_ROUTE.AUTH}/accounts/:publicRef/unlink`,
  SESSION_REVOKE: `${API_ROUTE.AUTH}/sessions/:publicRef/revoke`,
  accountCallback: (provider: string) => `${API_ROUTE.AUTH}/accounts/${provider}/callback`,
} as const

/** Dashboard Docs Import route family used by Core and Dash. */
export const DOCS_IMPORT_ROUTE = {
  PREVIEWS: '/api/docs/import/previews',
  PREVIEW_PATTERN: '/api/docs/import/previews/:previewRef',
  APPLY_PATTERN: '/api/docs/import/previews/:previewRef/apply',
  preview: (previewRef: string) => `/api/docs/import/previews/${encodeURIComponent(previewRef)}`,
  apply: (previewRef: string) =>
    `/api/docs/import/previews/${encodeURIComponent(previewRef)}/apply`,
} as const

export const COMMUNITY_SLUG_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

const LANDING_PATHS = new Set(['/', '/pricing', '/book-demo'])
const LANDING_STATIC_ASSET_PREFIXES = [
  '/landing/assets/',
  '/landing/apply/',
  '/landing/intro/',
  '/landing/products/',
  '/landing/seo/',
  '/landing/stacks/',
  '/landing/wallpaper/',
  '/avatars/',
  '/icons/',
  '/locales/',
  '/pattern/',
  '/pwa/',
]
const LANDING_ROOT_STATIC_ASSET_RE =
  /^\/(?:landing\/)?[^/]+\.(?:avif|gif|ico|jpe?g|json|png|svg|txt|webp|xml)$/
const DASHBOARD_API_PREFIXES = ['/api/content/', '/api/docs/import/', '/api/internal/docs-import/']
const DELETED_DASHBOARD_API_PATHS = new Set(['/api/revalidate/community'])

const normalizeHostname = (hostname: string): string =>
  hostname.trim().toLowerCase().replace(/\.$/, '').split(':')[0]

const normalizeExplicitPath = (pathname: string): string => {
  const normalized = pathname.replace(/\/+$/, '')
  return normalized || '/'
}

/** Checks the byte-limited slug grammar shared by platform and custom hosts. */
export const isValidCommunitySlug = (value: string): boolean =>
  new TextEncoder().encode(value).byteLength <= 30 && COMMUNITY_SLUG_RE.test(value)

/** Identifies landing pages that must stay on the platform root. */
export const isLandingPath = (pathname: string): boolean =>
  LANDING_PATHS.has(normalizeExplicitPath(pathname))

/** Identifies landing static assets before a path can be interpreted as a slug. */
export const isLandingStaticAssetPath = (pathname: string): boolean =>
  LANDING_STATIC_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
  LANDING_ROOT_STATIC_ASSET_RE.test(pathname)

/** Identifies the Auth service's public API path family. */
export const isAuthRoute = (pathname: string): boolean =>
  pathname === API_ROUTE.AUTH || pathname.startsWith(`${API_ROUTE.AUTH}/`)

/** Identifies the browser GraphQL facade path handled by Phoenix. */
export const isGraphqlRoute = (pathname: string): boolean => pathname === API_ROUTE.GRAPHQL

/** Identifies public Press output paths for platform-host routing. */
export const isPressRoute = (pathname: string): boolean =>
  /^\/[^/]+\/(?:post|blog|changelog|doc)\/.+\.md$/.test(pathname) ||
  /^\/[^/]+\/feed\.(?:xml|atom|json)$/.test(pathname) ||
  /^\/[^/]+\/(?:post|blog|changelog|doc)\/feed\.xml$/.test(pathname) ||
  /^\/[^/]+\/(?:llms\.txt|sitemap\.xml)$/.test(pathname)

const isCustomDomainPressRoute = (pathname: string): boolean =>
  /^\/(?:post|blog|changelog|doc)\/.+\.md$/.test(pathname) ||
  /^\/feed\.(?:xml|atom|json)$/.test(pathname) ||
  /^\/(?:post|blog|changelog|doc)\/feed\.xml$/.test(pathname) ||
  /^\/(?:llms\.txt|sitemap\.xml)$/.test(pathname)

const isDeletedProductRoute = (pathname: string): boolean => {
  const parts = pathname.split('/').filter(Boolean)
  return (
    pathname === '/apply' ||
    pathname.startsWith('/apply/') ||
    (parts.length >= 2 && (parts[1] === 'dashboard' || parts[1] === 'dash'))
  )
}

const isRetiredApiRoute = (pathname: string): boolean =>
  DELETED_DASHBOARD_API_PATHS.has(pathname) ||
  DASHBOARD_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))

const landingTargetPath = (pathname: string): string =>
  pathname.startsWith('/landing/assets/') ? pathname.slice('/landing'.length) : pathname

const route = (
  targetKind: RouteTargetKind,
  pathname: string,
  requestHeaderPolicy: RequestHeaderPolicy = 'pass-through',
  communitySlug?: string,
  routeClass: string = targetKind,
): PublicRoute => ({
  routeClass,
  targetKind,
  pathname,
  requestHeaderPolicy,
  ...(communitySlug ? { communitySlug } : {}),
})

const resolvePlatformRoute = (pathname: string, method: string): PublicRoute => {
  if (pathname === '/health' && method === 'GET') return route('health', pathname)
  if (pathname === '/health') {
    return route('not-found', pathname, 'pass-through', undefined, 'health-method')
  }
  if (pathname.startsWith('/health/')) {
    return route('not-found', pathname, 'pass-through', undefined, 'reserved-health')
  }
  if (isPressRoute(pathname)) return route('press', pathname, 'public-output')
  if (isLandingPath(pathname) || isLandingStaticAssetPath(pathname)) {
    return route(
      'landing',
      landingTargetPath(pathname),
      'pass-through',
      undefined,
      isLandingPath(pathname) ? 'landing-page' : 'landing-asset',
    )
  }
  if (isAuthRoute(pathname)) return route('auth', pathname)
  if (isGraphqlRoute(pathname)) {
    return route('phoenix', '/graphiql', 'graphql-browser-clean')
  }
  if (pathname === API_ROUTE.SLUGIFY) {
    return route('community', pathname, 'pass-through', undefined, 'community-tool')
  }
  if (isDeletedProductRoute(pathname) || isRetiredApiRoute(pathname)) {
    return route('not-found', pathname, 'pass-through', undefined, 'removed-product')
  }
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return route('not-found', pathname, 'pass-through', undefined, 'unknown-api')
  }

  const slug = pathname.split('/').filter(Boolean)[0]
  if (slug && isValidCommunitySlug(slug)) return route('community', pathname, 'pass-through', slug)

  return route('not-found', pathname, 'pass-through', undefined, 'invalid-public-path')
}

const resolveCustomDomainRoute = (pathname: string, communitySlug: string): PublicRoute => {
  if (pathname === API_ROUTE.SLUGIFY) {
    return route('community', pathname, 'pass-through', communitySlug, 'custom-community-tool')
  }
  const internalPath = `/${communitySlug}${pathname === '/' ? '' : pathname}`
  if (isCustomDomainPressRoute(pathname)) {
    return route('press', internalPath, 'public-output', communitySlug)
  }
  return route('community', internalPath, 'pass-through', communitySlug)
}

/** Resolves the production public host/path contract without runtime dependencies. */
export const resolvePublicRoute = ({
  hostname,
  pathname,
  method = 'GET',
  customDomainCommunities = {},
  platformHosts = PRODUCTION_PLATFORM_HOSTS,
}: ResolvePublicRouteInput): PublicRoute => {
  const normalizedHost = normalizeHostname(hostname)
  const normalizedPlatformHosts = platformHosts.map(normalizeHostname)
  if (normalizedPlatformHosts.includes(normalizedHost)) {
    return resolvePlatformRoute(pathname, method.toUpperCase())
  }

  const communitySlug = customDomainCommunities[normalizedHost]
  if (!communitySlug || !isValidCommunitySlug(communitySlug)) {
    return route('not-found', pathname, 'pass-through', undefined, 'unknown-host')
  }
  return resolveCustomDomainRoute(pathname, communitySlug)
}
