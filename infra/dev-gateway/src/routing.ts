/**
 * Maps canonical host/path inputs to one explicit Groupher service target.
 *
 * Business position:
 *
 *   Browser / service
 *     -> Gateway module
 *     -> selected Groupher application
 *     -> proxied response
 */

import {
  isAuthRoute as isPublicAuthRoute,
  isGraphqlRoute as isPublicGraphqlRoute,
  isPressRoute as isPublicPressRoute,
  resolvePublicRoute,
  type RequestHeaderPolicy as PublicRequestHeaderPolicy,
  type RouteTargetKind,
} from '@groupher/route-contract'

export type GatewayTargetKind =
  | 'dash'
  | 'apply'
  | 'landing'
  | 'community'
  | 'auth'
  | 'phoenix'
  | 'press'
  | 'not-found'

export type TRequestHeaderPolicy = PublicRequestHeaderPolicy
export type TResponsePolicy = 'pass-through'
export type TRedirectPolicy = 'preserve-upstream'

export type TGatewayTarget = {
  targetKind: GatewayTargetKind
  targetUrl: URL
  requestHeaderPolicy: TRequestHeaderPolicy
  responsePolicy: TResponsePolicy
  redirectPolicy: TRedirectPolicy
  requiresBodyProxy: boolean
  communitySlug?: string
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
  DASH: 'dash',
  APPLY: 'apply',
  COMMUNITY: 'community',
} as const

export const STATIC_PATHS = ['/', '/pricing', '/book-demo']

export const SITE = {
  LANDING: process.env.LANDING_SITE || `https://${APP.LANDING}.groupher.com`,
  DASH: process.env.DASH_SITE || `https://${APP.DASH}.groupher.com`,
  APPLY: process.env.APPLY_SITE || `https://${APP.APPLY}.groupher.com`,
  COMMUNITY: process.env.COMMUNITY_SITE || `https://${APP.COMMUNITY}.groupher.com`,
  AUTH: process.env.AUTH_SITE || 'https://auth.groupher.com',
  API:
    process.env.API_SITE ||
    (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:4001' : 'https://api.groupher.com'),
  PRESS: process.env.PRESS_SITE || 'http://127.0.0.1:8003',
}

/** Reports whether auth route at the gateway boundary. */
export const isAuthRoute = (pathname: string): boolean => isPublicAuthRoute(pathname)
/** Reports whether graphql route at the gateway boundary. */
export const isGraphqlRoute = (pathname: string): boolean => isPublicGraphqlRoute(pathname)
const isDashViteAssetRoute = (pathname: string): boolean => pathname.startsWith('/__dash_hmr')
const isLandingViteAssetRoute = (pathname: string): boolean => pathname.startsWith('/__landing_hmr')
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
const isUnprefixedStaticAssetRoute = (pathname: string): boolean =>
  /\.(?:avif|css|gif|ico|jpe?g|js|json|png|svg|webp|woff2?)$/i.test(pathname)
const isSharedCoreAssetRoute = (pathname: string): boolean =>
  pathname.startsWith('/fa/') ||
  pathname.startsWith('/icons/') ||
  pathname.startsWith('/wallpaper/')

const isAppHost = (host: string, app: string): boolean => host.startsWith(`${app}.`)

/** Reports whether landing host at the gateway boundary. */
export const isLandingHost = (host: string): boolean => isAppHost(host, APP.LANDING)

/** Reports whether dash host at the gateway boundary. */
export const isDashHost = (host: string): boolean => isAppHost(host, APP.DASH)

/** Reports whether apply host at the gateway boundary. */
export const isApplyHost = (host: string): boolean => isAppHost(host, APP.APPLY)

/** Reports whether community host at the gateway boundary. */
export const isCommunityHost = (host: string): boolean => isAppHost(host, APP.COMMUNITY)

/** Reports whether platform root host at the gateway boundary. */
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

/** Reports whether press route at the gateway boundary. */
export const isPressRoute = (pathname: string): boolean => isPublicPressRoute(pathname)

const customDomainCommunities = (): Record<string, string> => {
  try {
    const mapping: unknown = JSON.parse(process.env.CUSTOM_DOMAIN_COMMUNITIES || '{}')
    return mapping && typeof mapping === 'object' && !Array.isArray(mapping)
      ? (mapping as Record<string, string>)
      : {}
  } catch {
    return {}
  }
}

const LANDING_STATIC_SIGN = `/${APP.LANDING}/assets/`

/** Reports whether landing static route at the gateway boundary. */
export const isLandingStaticRoute = (pathname: string): boolean =>
  pathname.startsWith(LANDING_STATIC_SIGN)

/** Reports whether dash route at the gateway boundary. */
export const isDashRoute = (_pathname: string, host: string): boolean => isDashHost(host)

/** Reports whether apply route at the gateway boundary. */
export const isApplyRoute = (_pathname: string, host: string): boolean => isApplyHost(host)

/** Returns dash url for the gateway workflow. */
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
  communitySlug?: string,
): TGatewayTarget => ({
  targetKind,
  targetUrl,
  requestHeaderPolicy,
  responsePolicy: 'pass-through',
  redirectPolicy: 'preserve-upstream',
  requiresBodyProxy: shouldForwardBody(method),
  ...(communitySlug ? { communitySlug } : {}),
})

const notFoundTarget = (pathname: string, search: string, method?: string): TGatewayTarget =>
  target('not-found', new URL(pathname + search, 'http://gateway.invalid'), method)

const PUBLIC_TARGET_SITE: Partial<Record<RouteTargetKind, string>> = {
  landing: SITE.LANDING,
  community: SITE.COMMUNITY,
  auth: SITE.AUTH,
  phoenix: SITE.API,
  press: SITE.PRESS,
}

const publicTarget = (
  pathname: string,
  search: string,
  method: string | undefined,
  routingHost: string,
): TGatewayTarget => {
  const resolved = resolvePublicRoute({
    hostname: routingHost,
    pathname,
    method,
    customDomainCommunities: customDomainCommunities(),
    platformHosts: [
      'groupher.com',
      'www.groupher.com',
      'groupher.localhost',
      'localhost',
      '127.0.0.1',
    ],
  })

  if (resolved.targetKind === 'not-found' || resolved.targetKind === 'health') {
    return notFoundTarget(pathname, search, method)
  }

  const site = PUBLIC_TARGET_SITE[resolved.targetKind]
  if (!site) return notFoundTarget(pathname, search, method)
  return target(
    resolved.targetKind,
    new URL(resolved.pathname + search, site),
    method,
    resolved.requestHeaderPolicy,
    resolved.communitySlug,
  )
}

/** Resolves gateway target without leaking gateway routing details to callers. */
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

  if (isLandingHost(routingHost)) {
    return target('landing', new URL(fullPath, SITE.LANDING), method)
  }

  if (isDashHost(routingHost)) {
    return target('dash', getDashUrl(pathname, routingHost, search), method)
  }

  if (isApplyHost(routingHost)) {
    return target('apply', new URL(fullPath, SITE.APPLY), method)
  }

  if (isCommunityHost(routingHost)) {
    return target('community', new URL(fullPath, SITE.COMMUNITY), method)
  }

  if (isApplyViteAssetRoute(pathname)) {
    return target('apply', new URL(fullPath, SITE.APPLY), method)
  }

  if (isLandingViteAssetRoute(pathname)) {
    return target('landing', new URL(fullPath, SITE.LANDING), method)
  }

  // App-specific HMR sockets don't carry a reliable Referer during upgrade.
  if (isDashViteAssetRoute(pathname)) {
    return target('dash', new URL(fullPath, SITE.DASH), method)
  }

  if (
    (isSharedViteAssetRoute(pathname) ||
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

    if (STATIC_PATHS.includes(refererUrl.pathname) || isLandingHost(refererUrl.host)) {
      return target('landing', new URL(fullPath, SITE.LANDING), method)
    }
  }

  if (isDashRoute(pathname, routingHost)) {
    return target('dash', getDashUrl(pathname, routingHost, search), method)
  }

  return publicTarget(pathname, search, method, routingHost)
}
