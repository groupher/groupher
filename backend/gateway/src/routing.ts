export type GatewayTargetKind =
  | 'main'
  | 'dashboard'
  | 'dash'
  | 'apply'
  | 'landing'
  | 'auth'
  | 'phoenix'
  | 'press'

export type TRequestHeaderPolicy = 'pass-through' | 'graphql-browser-clean'
export type TResponsePolicy = 'pass-through'
export type TRedirectPolicy = 'preserve-upstream'

export type TGatewayTarget = {
  targetKind: GatewayTargetKind
  targetUrl: URL
  requestHeaderPolicy: TRequestHeaderPolicy
  responsePolicy: TResponsePolicy
  redirectPolicy: TRedirectPolicy
  requiresBodyProxy: boolean
}

type TResolveGatewayTargetInput = {
  pathname: string
  search?: string
  method?: string
  host: string
  forwardedHost?: string | null
  referer?: string | null
}

const APP = {
  LANDING: 'landing',
  DASHBOARD: 'dashboard',
  DASH: 'dash',
  APPLY: 'apply',
  MAIN: 'main',
} as const

export const STATIC_PATHS = ['/', '/pricing', '/book-demo']

export const SITE = {
  LANDING: process.env.LANDING_SITE || `https://${APP.LANDING}.groupher.com`,
  MAIN: process.env.MAIN_SITE || `https://${APP.MAIN}.groupher.com`,
  DASHBOARD: process.env.DASHBOARD_SITE || `https://${APP.DASHBOARD}.groupher.com`,
  DASH: process.env.DASH_SITE || `https://${APP.DASH}.groupher.com`,
  APPLY: process.env.APPLY_SITE || `https://${APP.APPLY}.groupher.com`,
  AUTH: process.env.AUTH_SITE || 'https://auth.groupher.com',
  API:
    process.env.API_SITE ||
    (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:4001' : 'https://api.groupher.com'),
  PRESS: process.env.PRESS_SITE || 'http://127.0.0.1:8003',
}

export const isAuthRoute = (pathname: string): boolean => pathname.startsWith('/api/auth/')
export const isGraphqlRoute = (pathname: string): boolean => pathname === '/api/graphql'
const isNextStaticRoute = (pathname: string): boolean => pathname.startsWith('/_next/static/')
const isDashViteAssetRoute = (pathname: string): boolean => pathname.startsWith('/__dash_hmr')
const isSharedViteAssetRoute = (pathname: string): boolean =>
  pathname.startsWith('/@fs/') ||
  pathname.startsWith('/@id/') ||
  pathname.startsWith('/@react-refresh') ||
  pathname.startsWith('/@tanstack-start/') ||
  pathname.startsWith('/@vite/') ||
  pathname.startsWith('/node_modules/.vite/') ||
  pathname.startsWith('/src/') ||
  pathname.startsWith('/_vite/')
const isDashVirtualDevClientReferer = (refererUrl: URL | null): boolean =>
  Boolean(
    refererUrl &&
    isPlatformRootHost(refererUrl.host) &&
    refererUrl.pathname === '/@id/virtual:tanstack-start-dev-client-entry',
  )
const isDashViteModuleReferer = (refererUrl: URL | null): boolean =>
  Boolean(
    refererUrl &&
    isPlatformRootHost(refererUrl.host) &&
    (refererUrl.pathname.startsWith('/@fs/') ||
      refererUrl.pathname.startsWith('/@react-refresh') ||
      refererUrl.pathname.startsWith('/@vite/') ||
      refererUrl.pathname.startsWith('/@tanstack-start/') ||
      refererUrl.pathname.startsWith('/node_modules/.vite/') ||
      refererUrl.pathname.startsWith('/src/') ||
      refererUrl.pathname.startsWith('/_vite/')),
  )
const isApplyViteAssetRoute = (pathname: string): boolean => pathname.startsWith('/__apply_hmr')
const isTanStackServerFnRoute = (pathname: string): boolean => pathname.startsWith('/_serverFn/')
const isUnprefixedDevAssetRoute = (pathname: string): boolean =>
  isNextStaticRoute(pathname) || pathname.startsWith('/_next/hmr')
const isUnprefixedStaticAssetRoute = (pathname: string): boolean =>
  /\.(?:avif|css|gif|ico|jpe?g|js|json|png|svg|webp|woff2?)$/i.test(pathname)
const isSharedCoreAssetRoute = (pathname: string): boolean =>
  pathname.startsWith('/fa/') ||
  pathname.startsWith('/icons/') ||
  pathname.startsWith('/wallpaper/')

const isAppHost = (host: string, app: string): boolean => host.startsWith(`${app}.`)

export const isMainHost = (host: string): boolean => isAppHost(host, APP.MAIN)

export const isLandingHost = (host: string): boolean => isAppHost(host, APP.LANDING)

export const isDashHost = (host: string): boolean => isAppHost(host, APP.DASH)

export const isApplyHost = (host: string): boolean => isAppHost(host, APP.APPLY)

export const isPlatformRootHost = (host: string): boolean => {
  const hostname = host.split(':')[0].toLowerCase()
  return [
    'groupher.com',
    'www.groupher.com',
    'groupher.localhost',
    'localhost',
    '127.0.0.1',
  ].includes(hostname)
}

export const isPressRoute = (pathname: string): boolean =>
  /^\/[^/]+\/(feed\.(xml|atom|json)|llms\.txt|sitemap\.xml)$/.test(pathname) ||
  /^\/[^/]+\/(post|blog|changelog)\/[^/]+\.md$/.test(pathname) ||
  /^\/[^/]+\/doc\/[^/]+(?:\/[^/]+)?\.md$/.test(pathname) ||
  /^\/[^/]+\/(post|blog|changelog|doc)\/feed\.xml$/.test(pathname)

const customDomainCommunity = (host: string): string | null => {
  try {
    const mapping = JSON.parse(process.env.CUSTOM_DOMAIN_COMMUNITIES || '{}') as Record<
      string,
      string
    >
    const community = mapping[host.split(':')[0].toLowerCase()]
    return community && /^[a-z0-9][a-z0-9-]*$/.test(community) ? community : null
  } catch {
    return null
  }
}

const customDomainPressPath = (pathname: string, host: string): string | null => {
  if (
    !/^\/(feed\.(xml|atom|json)|llms\.txt|sitemap\.xml)$/.test(pathname) &&
    !/^\/(post|blog|changelog|doc)\/feed\.xml$/.test(pathname) &&
    !/^\/(post|blog|changelog)\/[^/]+\.md$/.test(pathname) &&
    !/^\/doc\/[^/]+(?:\/[^/]+)?\.md$/.test(pathname)
  )
    return null
  const community = customDomainCommunity(host)
  return community ? `/${community}${pathname}` : null
}

const LANDING_STATIC_SIGN = `/${APP.LANDING}/_next/static`
const DASHBOARD_STATIC_SIGN = `/${APP.DASHBOARD}/_next/static`
const DASHBOARD_NEXT_SIGN = `/${APP.DASHBOARD}/_next/`

export const isLandingStaticRoute = (pathname: string): boolean =>
  pathname.startsWith(LANDING_STATIC_SIGN)

export const isDashboardStaticRoute = (pathname: string): boolean =>
  pathname.startsWith(DASHBOARD_STATIC_SIGN)

const isDashboardNextRoute = (pathname: string): boolean => pathname.startsWith(DASHBOARD_NEXT_SIGN)

export const isDashboardRoute = (pathname: string, host: string): boolean => {
  if (isAppHost(host, APP.DASHBOARD)) {
    return true
  }

  const pathParts = pathname.split('/').filter(Boolean)
  return pathParts.length >= 2 && pathParts[1] === 'dashboard'
}

export const isDashRoute = (pathname: string, host: string): boolean => {
  if (isDashHost(host)) {
    return true
  }

  const pathParts = pathname.split('/').filter(Boolean)
  return pathParts.length >= 2 && pathParts[1] === 'dash'
}

export const isApplyRoute = (pathname: string, host: string): boolean =>
  isApplyHost(host) || pathname === '/apply' || pathname.startsWith('/apply/')

export const getDashboardUrl = (pathname: string, host: string, search = ''): URL => {
  return new URL(pathname + search, SITE.DASHBOARD)
}

export const getDashUrl = (pathname: string, _host: string, search = ''): URL =>
  new URL(pathname + search, SITE.DASH)

const firstForwardedHost = (forwardedHost?: string | null): string | null =>
  forwardedHost?.split(',')[0]?.trim() || null

const getRefererUrl = (referer?: string | null): URL | null => {
  if (!referer) return null

  try {
    return new URL(referer)
  } catch {
    return null
  }
}

const shouldForwardBody = (method = 'GET'): boolean =>
  !['GET', 'HEAD'].includes(method.toUpperCase())

const target = (
  targetKind: GatewayTargetKind,
  targetUrl: URL,
  method?: string,
  requestHeaderPolicy: TRequestHeaderPolicy = 'pass-through',
): TGatewayTarget => ({
  targetKind,
  targetUrl,
  requestHeaderPolicy,
  responsePolicy: 'pass-through',
  redirectPolicy: 'preserve-upstream',
  requiresBodyProxy: shouldForwardBody(method),
})

export const resolveGatewayTarget = ({
  pathname,
  search = '',
  method,
  host,
  forwardedHost,
  referer,
}: TResolveGatewayTargetInput): TGatewayTarget => {
  const routingHost = firstForwardedHost(forwardedHost) || host
  const fullPath = pathname + search
  const refererUrl = getRefererUrl(referer)

  if (isAuthRoute(pathname)) {
    return target('auth', new URL(fullPath, SITE.AUTH), method)
  }

  if (isGraphqlRoute(pathname)) {
    return target(
      'phoenix',
      new URL(`/graphiql${search}`, SITE.API),
      method,
      'graphql-browser-clean',
    )
  }

  const customPressPath = customDomainPressPath(pathname, routingHost)
  if (customPressPath) return target('press', new URL(customPressPath + search, SITE.PRESS), method)

  if (isPressRoute(pathname)) {
    if (pathname === '/sitemap.xml' && isPlatformRootHost(routingHost)) {
      return target('main', new URL(fullPath, SITE.MAIN), method)
    }
    return target('press', new URL(fullPath, SITE.PRESS), method)
  }

  if (isMainHost(routingHost)) {
    return target('main', new URL(fullPath, SITE.MAIN), method)
  }

  if (isLandingHost(routingHost)) {
    return target('landing', new URL(fullPath, SITE.LANDING), method)
  }

  if (isDashHost(routingHost)) {
    return target('dash', getDashUrl(pathname, routingHost, search), method)
  }

  if (isApplyHost(routingHost)) {
    return target('apply', new URL(fullPath, SITE.APPLY), method)
  }

  if (isApplyRoute(pathname, routingHost)) {
    return target('apply', new URL(fullPath, SITE.APPLY), method)
  }

  if (isApplyViteAssetRoute(pathname)) {
    return target('apply', new URL(fullPath, SITE.APPLY), method)
  }

  // App-specific HMR sockets don't carry a reliable Referer during upgrade.
  if (isDashViteAssetRoute(pathname)) {
    return target('dash', new URL(fullPath, SITE.DASH), method)
  }

  if (isDashboardNextRoute(pathname)) {
    return target('dashboard', new URL(fullPath, SITE.DASHBOARD), method)
  }

  if (
    (isUnprefixedDevAssetRoute(pathname) ||
      isSharedViteAssetRoute(pathname) ||
      isUnprefixedStaticAssetRoute(pathname) ||
      isSharedCoreAssetRoute(pathname) ||
      isTanStackServerFnRoute(pathname)) &&
    refererUrl
  ) {
    if (isDashVirtualDevClientReferer(refererUrl) || isDashViteModuleReferer(refererUrl)) {
      return target('dash', new URL(fullPath, SITE.DASH), method)
    }

    if (isDashRoute(refererUrl.pathname, refererUrl.host)) {
      return target('dash', new URL(fullPath, SITE.DASH), method)
    }

    if (isApplyRoute(refererUrl.pathname, refererUrl.host)) {
      return target('apply', new URL(fullPath, SITE.APPLY), method)
    }

    if (isDashboardRoute(refererUrl.pathname, refererUrl.host)) {
      return target('dashboard', new URL(fullPath, SITE.DASHBOARD), method)
    }

    if (STATIC_PATHS.includes(refererUrl.pathname) || isLandingHost(refererUrl.host)) {
      return target('landing', new URL(fullPath, SITE.LANDING), method)
    }
  }

  if (isDashboardRoute(pathname, routingHost)) {
    return target('dashboard', getDashboardUrl(pathname, routingHost, search), method)
  }

  if (isDashRoute(pathname, routingHost)) {
    return target('dash', getDashUrl(pathname, routingHost, search), method)
  }

  if (isDashboardStaticRoute(pathname)) {
    return target('dashboard', new URL(fullPath, SITE.DASHBOARD), method)
  }

  if (STATIC_PATHS.includes(pathname) || isLandingStaticRoute(pathname)) {
    return target('landing', new URL(fullPath, SITE.LANDING), method)
  }

  return target('main', new URL(fullPath, SITE.MAIN), method)
}
