const GROUPHER_AUTH_TOKEN_COOKIE = 'groupher-auth.token'

const DEFAULT_SITE = {
  MAIN: 'https://main.groupher.com',
  DASHBOARD: 'https://dashboard.groupher.com',
  AUTH: 'https://auth.groupher.com',
  API: 'https://api.groupher.com',
}

const HOP_BY_HOP_HEADERS = [
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]

const LANDING_PATHS = ['/', '/pricing', '/book-demo']
const DASHBOARD_ASSET_PREFIX = '/dashboard/_next/'
const LANDING_STATIC_ASSET_PREFIXES = [
  '/landing/',
  '/landing/_next/static/',
  '/avatars/',
  '/icons/',
  '/locales/',
  '/pattern/',
  '/pwa/',
]
const LANDING_ROOT_STATIC_ASSET_RE = /^\/[^/]+\.(?:ico|json|png|txt|webp|xml)$/
const DASHBOARD_API_PREFIXES = ['/api/artiment/', '/api/docs/import/', '/api/internal/docs-import/']
const DASHBOARD_API_PATHS = ['/api/revalidate/community', '/api/utils/slugify']

const json = (body, init = {}) =>
  Response.json(body, {
    ...init,
    headers: {
      'Cache-Control': 'no-store',
      ...(init.headers || {}),
    },
  })

const safeDecode = (value) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export const readCookie = (headers, name) => {
  const cookieHeader = headers.get('cookie')
  if (!cookieHeader) return null

  for (const cookie of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = cookie.trim().split('=')
    if (rawName === name) return safeDecode(rawValue.join('='))
  }

  return null
}

const siteUrl = (env, name) => {
  const value = env[`${name}_SITE`] || DEFAULT_SITE[name]
  return value.endsWith('/') ? value : `${value}/`
}

const normalizeExplicitPath = (pathname) => {
  const normalized = pathname.replace(/\/+$/, '')
  return normalized || '/'
}

export const isLandingPath = (pathname) => LANDING_PATHS.includes(normalizeExplicitPath(pathname))

const isLandingStaticAssetPath = (pathname) =>
  LANDING_STATIC_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
  LANDING_ROOT_STATIC_ASSET_RE.test(pathname)

const isAuthRoute = (pathname) => pathname === '/api/auth' || pathname.startsWith('/api/auth/')

const isGraphqlRoute = (pathname) => pathname === '/api/graphql'

const isDashboardApiRoute = (pathname) =>
  DASHBOARD_API_PATHS.includes(pathname) ||
  DASHBOARD_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))

const isDashboardRoute = (pathname) => {
  if (pathname.startsWith(DASHBOARD_ASSET_PREFIX)) return true

  const parts = pathname.split('/').filter(Boolean)
  return parts.length >= 2 && parts[1] === 'dashboard'
}

const targetUrl = (base, pathname, search = '') => {
  const url = new URL(base)
  url.pathname = pathname
  url.search = search
  return url
}

export const resolveCloudflareTarget = ({ pathname, search = '' }, env) => {
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

  return {
    kind: 'main',
    url: targetUrl(siteUrl(env, 'MAIN'), pathname, search),
    requestHeaderPolicy: 'pass-through',
  }
}

export const buildProxyHeaders = (request, target) => {
  const headers = new Headers(request.headers)
  const requestUrl = new URL(request.url)

  for (const header of HOP_BY_HOP_HEADERS) {
    headers.delete(header)
  }

  headers.delete('forwarded')
  headers.delete('x-forwarded-host')
  headers.delete('x-forwarded-proto')
  headers.delete('x-forwarded-for')
  headers.set('x-forwarded-host', requestUrl.host)
  headers.set('x-forwarded-proto', requestUrl.protocol.replace(':', ''))

  const connectingIp = request.headers.get('cf-connecting-ip')
  if (connectingIp) {
    headers.set('x-forwarded-for', connectingIp)
  }

  if (target.requestHeaderPolicy === 'graphql-browser-clean') {
    const authToken = readCookie(request.headers, GROUPHER_AUTH_TOKEN_COOKIE)

    headers.delete('authorization')
    headers.delete('cookie')

    if (authToken) {
      headers.set('cookie', `${GROUPHER_AUTH_TOKEN_COOKIE}=${encodeURIComponent(authToken)}`)
    }
  }

  return headers
}

export const proxyRequest = (request, target, fetcher = fetch) => {
  const init = {
    method: request.method,
    headers: buildProxyHeaders(request, target),
    redirect: 'manual',
    body: ['GET', 'HEAD'].includes(request.method.toUpperCase()) ? null : request.body,
  }

  return fetcher(target.url, init)
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/health') {
      return json({
        schemaVersion: 'health.v1',
        status: 'ok',
        service: 'landing-cloudflare-router',
        environment: env.ENVIRONMENT || 'production',
        timestamp: new Date().toISOString(),
        checks: [],
      })
    }

    if (isLandingPath(url.pathname) || isLandingStaticAssetPath(url.pathname)) {
      return env.ASSETS.fetch(request)
    }

    const target = resolveCloudflareTarget(
      {
        pathname: url.pathname,
        search: url.search,
      },
      env,
    )

    return proxyRequest(request, target, env.fetcher || fetch)
  },
}
