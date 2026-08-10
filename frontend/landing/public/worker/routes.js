import {
  DASHBOARD_API_PATHS,
  DASHBOARD_API_PREFIXES,
  DASHBOARD_ASSET_PREFIX,
  DEFAULT_SITE,
  LANDING_PATHS,
  LANDING_ROOT_STATIC_ASSET_RE,
  LANDING_STATIC_ASSET_PREFIXES,
} from './config.js'

export const siteUrl = (env, name) => {
  const value = env[`${name}_SITE`] || DEFAULT_SITE[name]
  return value.endsWith('/') ? value : `${value}/`
}

const normalizeExplicitPath = (pathname) => {
  const normalized = pathname.replace(/\/+$/, '')
  return normalized || '/'
}

export const isLandingPath = (pathname) => LANDING_PATHS.includes(normalizeExplicitPath(pathname))

export const isLandingStaticAssetPath = (pathname) =>
  LANDING_STATIC_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
  LANDING_ROOT_STATIC_ASSET_RE.test(pathname)

export const isAuthRoute = (pathname) =>
  pathname === '/api/auth' || pathname.startsWith('/api/auth/')

export const isGraphqlRoute = (pathname) => pathname === '/api/graphql'

export const isDashboardApiRoute = (pathname) =>
  DASHBOARD_API_PATHS.includes(pathname) ||
  DASHBOARD_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))

export const isDashboardRoute = (pathname) => {
  if (pathname.startsWith(DASHBOARD_ASSET_PREFIX)) return true

  const parts = pathname.split('/').filter(Boolean)
  return parts.length >= 2 && parts[1] === 'dashboard'
}

export const isDashRoute = (pathname) => {
  const parts = pathname.split('/').filter(Boolean)
  return parts.length >= 2 && parts[1] === 'dash'
}

const PRESS_MARKDOWN_RE = /^\/[^/]+\/(?:doc\/[^/]+\/.+\.md|(?:post|blog|changelog|doc)\/.+\.md)$/
const PRESS_FEED_RE = /^\/[^/]+\/feed\.(?:xml|atom|json)$/
const PRESS_THREAD_FEED_RE = /^\/[^/]+\/(?:post|blog|changelog|doc)\/feed\.xml$/
const PRESS_SITE_RE = /^\/[^/]+\/(?:llms\.txt|sitemap\.xml)$/

export const isPressRoute = (pathname) =>
  PRESS_MARKDOWN_RE.test(pathname) ||
  PRESS_FEED_RE.test(pathname) ||
  PRESS_THREAD_FEED_RE.test(pathname) ||
  PRESS_SITE_RE.test(pathname)

const targetUrl = (base, pathname, search = '') => {
  const url = new URL(base)
  url.pathname = pathname
  url.search = search
  return url
}

export const resolveCloudflareTarget = ({ pathname, search = '' }, env) => {
  if (pathname === '/health/dash') {
    return {
      kind: 'dash',
      url: targetUrl(siteUrl(env, 'DASH'), '/health', search),
      requestHeaderPolicy: 'pass-through',
    }
  }

  if (isPressRoute(pathname)) {
    return {
      kind: 'press',
      url: targetUrl(siteUrl(env, 'PRESS'), pathname, search),
      requestHeaderPolicy: 'public-output',
    }
  }

  if (isGraphqlRoute(pathname)) {
    return {
      kind: 'phoenix',
      url: targetUrl(siteUrl(env, 'API'), '/graphiql', search),
      requestHeaderPolicy: 'graphql-browser-clean',
    }
  }

  if (isAuthRoute(pathname)) {
    return {
      kind: 'auth',
      url: targetUrl(siteUrl(env, 'AUTH'), pathname, search),
      requestHeaderPolicy: 'pass-through',
    }
  }

  if (isDashboardApiRoute(pathname)) {
    return {
      kind: 'dashboard',
      url: targetUrl(siteUrl(env, 'DASHBOARD'), pathname, search),
      requestHeaderPolicy: 'pass-through',
    }
  }

  if (isDashboardRoute(pathname)) {
    return {
      kind: 'dashboard',
      url: targetUrl(siteUrl(env, 'DASHBOARD'), pathname, search),
      requestHeaderPolicy: 'pass-through',
    }
  }

  if (isDashRoute(pathname)) {
    return {
      kind: 'dash',
      url: targetUrl(siteUrl(env, 'DASH'), pathname, search),
      requestHeaderPolicy: 'pass-through',
    }
  }

  return {
    kind: 'main',
    url: targetUrl(siteUrl(env, 'MAIN'), pathname, search),
    requestHeaderPolicy: 'pass-through',
  }
}
