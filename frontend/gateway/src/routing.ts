export type GatewayTargetKind = 'main' | 'dashboard' | 'landing' | 'auth' | 'phoenix'

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
  MAIN: 'main',
} as const

export const STATIC_PATHS = ['/', '/pricing', '/book-demo']

export const SITE = {
  LANDING: process.env.LANDING_SITE || `https://${APP.LANDING}.groupher.com`,
  MAIN: process.env.MAIN_SITE || `https://${APP.MAIN}.groupher.com`,
  DASHBOARD: process.env.DASHBOARD_SITE || `https://${APP.DASHBOARD}.groupher.com`,
  AUTH: process.env.AUTH_SITE || 'https://auth.groupher.com',
  API:
    process.env.API_SITE ||
    (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:4001' : 'https://api.groupher.com'),
}

export const isAuthRoute = (pathname: string): boolean => pathname.startsWith('/api/auth/')
export const isGraphqlRoute = (pathname: string): boolean => pathname === '/api/graphql'
const isNextStaticRoute = (pathname: string): boolean => pathname.startsWith('/_next/static/')

const isAppHost = (host: string, app: string): boolean => host.startsWith(`${app}.`)

export const isMainHost = (host: string): boolean => isAppHost(host, APP.MAIN)

export const isLandingHost = (host: string): boolean => isAppHost(host, APP.LANDING)

const getNextStaticSign = (url: string): string => {
  const subdomain = new URL(url).hostname.split('.')[0]
  return `/${subdomain}/_next/static`
}

const LANDING_STATIC_SIGN = getNextStaticSign(SITE.LANDING)
const DASHBOARD_STATIC_SIGN = getNextStaticSign(SITE.DASHBOARD)

export const isLandingStaticRoute = (pathname: string): boolean =>
  pathname.startsWith(LANDING_STATIC_SIGN)

export const isDashboardStaticRoute = (pathname: string): boolean =>
  pathname.startsWith(DASHBOARD_STATIC_SIGN)

export const isDashboardRoute = (pathname: string, host: string): boolean => {
  if (isAppHost(host, APP.DASHBOARD)) {
    return true
  }

  const pathParts = pathname.split('/').filter(Boolean)
  return pathParts.length >= 2 && pathParts[1] === 'dashboard'
}

export const getDashboardUrl = (pathname: string, host: string, search = ''): URL => {
  if (isAppHost(host, APP.DASHBOARD)) {
    return new URL(pathname + search, SITE.DASHBOARD)
  }

  const pathParts = pathname.split('/').filter(Boolean)
  if (pathParts.length >= 2) {
    const dashboardPath = `/${pathParts[0]}${pathParts.length > 2 ? `/${pathParts.slice(2).join('/')}` : ''}`
    return new URL(dashboardPath + search, SITE.DASHBOARD)
  }

  return new URL('/', SITE.DASHBOARD)
}

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

  if (isMainHost(routingHost)) {
    return target('main', new URL(fullPath, SITE.MAIN), method)
  }

  if (isLandingHost(routingHost)) {
    return target('landing', new URL(fullPath, SITE.LANDING), method)
  }

  if (isNextStaticRoute(pathname) && refererUrl) {
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

  if (isDashboardStaticRoute(pathname)) {
    return target('dashboard', new URL(fullPath, SITE.DASHBOARD), method)
  }

  if (STATIC_PATHS.includes(pathname) || isLandingStaticRoute(pathname)) {
    return target('landing', new URL(fullPath, SITE.LANDING), method)
  }

  return target('main', new URL(fullPath, SITE.MAIN), method)
}
