export const GROUPHER_AUTH_TOKEN_COOKIE = 'groupher-auth.token'

export const DEFAULT_SITE = {
  MAIN: 'https://main.groupher.com',
  DASHBOARD: 'https://dashboard.groupher.com',
  AUTH: 'https://auth.groupher.com',
  API: 'https://api.groupher.com',
}

export const HOP_BY_HOP_HEADERS = [
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

export const LANDING_PATHS = ['/', '/pricing', '/book-demo']
export const DASHBOARD_ASSET_PREFIX = '/dashboard/_next/'
export const LANDING_STATIC_ASSET_PREFIXES = [
  '/landing/',
  '/landing/_next/static/',
  '/avatars/',
  '/icons/',
  '/locales/',
  '/pattern/',
  '/pwa/',
]
export const LANDING_ROOT_STATIC_ASSET_RE = /^\/[^/]+\.(?:ico|json|png|txt|webp|xml)$/
export const DASHBOARD_API_PREFIXES = ['/api/artiment/', '/api/docs/import/', '/api/internal/docs-import/']
export const DASHBOARD_API_PATHS = ['/api/revalidate/community', '/api/utils/slugify']
