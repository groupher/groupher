import { GROUPHER_AUTH_TOKEN_COOKIE, GROUPHER_VIEWER_COOKIE } from '@groupher/contracts/auth'
import { GROUPHER_COMMUNITY_SLUG_HEADER } from '@groupher/contracts/headers'
import type { RequestHeaderPolicy } from '@groupher/route-contract'

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

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const readCookie = (headers: Headers, name: string): string | null => {
  const cookieHeader = headers.get('cookie')
  if (!cookieHeader) return null

  for (const cookie of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = cookie.trim().split('=')
    if (rawName === name) return safeDecode(rawValue.join('='))
  }
  return null
}

/** Rebuilds trusted proxy headers and removes client-supplied forwarding claims. */
export const buildProxyHeaders = (
  request: Request,
  requestHeaderPolicy: RequestHeaderPolicy,
  communitySlug?: string,
): Headers => {
  const headers = new Headers(request.headers)
  const requestUrl = new URL(request.url)

  for (const header of HOP_BY_HOP_HEADERS) headers.delete(header)
  headers.delete('forwarded')
  headers.delete('x-forwarded-for')
  headers.delete('x-forwarded-host')
  headers.delete('x-forwarded-proto')
  headers.delete(GROUPHER_COMMUNITY_SLUG_HEADER)

  headers.set('x-forwarded-host', requestUrl.host)
  headers.set('x-forwarded-proto', requestUrl.protocol.replace(':', ''))
  const connectingIp = request.headers.get('cf-connecting-ip')
  if (connectingIp) headers.set('x-forwarded-for', connectingIp)
  if (communitySlug) {
    headers.set(GROUPHER_COMMUNITY_SLUG_HEADER, communitySlug)
  }

  if (requestHeaderPolicy === 'graphql-browser-clean') {
    const authToken = readCookie(request.headers, GROUPHER_AUTH_TOKEN_COOKIE)
    const viewerSession = readCookie(request.headers, GROUPHER_VIEWER_COOKIE)
    headers.delete('authorization')
    headers.delete('cookie')
    const cookies = [
      authToken && `${GROUPHER_AUTH_TOKEN_COOKIE}=${encodeURIComponent(authToken)}`,
      viewerSession && `${GROUPHER_VIEWER_COOKIE}=${encodeURIComponent(viewerSession)}`,
    ].filter(Boolean)
    if (cookies.length) headers.set('cookie', cookies.join('; '))
  }

  if (requestHeaderPolicy === 'public-output') {
    headers.delete('authorization')
    headers.delete('cookie')
  }

  return headers
}
