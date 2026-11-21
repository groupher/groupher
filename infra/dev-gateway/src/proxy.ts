/**
 * Forwards bounded HTTP requests and responses between Gateway and a selected target.
 *
 * Business position:
 *
 *   Browser / service
 *     -> Gateway module
 *     -> selected Groupher application
 *     -> proxied response
 */

import { GROUPHER_AUTH_TOKEN_COOKIE, GROUPHER_VIEWER_COOKIE } from '@groupher/contracts/auth'
import { GROUPHER_COMMUNITY_SLUG_HEADER } from '@groupher/contracts/headers'

import type { TGatewayTarget } from './routing'

type TFetch = typeof fetch
type TNodeRequestInit = RequestInit & { duplex?: 'half' }

type TProxyOptions = {
  fetcher?: TFetch
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

const AUTO_DECODED_RESPONSE_HEADERS = ['content-encoding', 'content-length']

const firstHeaderValue = (value: string | null): string | null =>
  value?.split(',')[0]?.trim() || null

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

/** Builds proxy headers from typed gateway inputs. */
export const buildProxyHeaders = (request: Request, target: TGatewayTarget): Headers => {
  const headers = new Headers(request.headers)
  const requestUrl = new URL(request.url)
  const forwardedHost = firstHeaderValue(headers.get('x-forwarded-host')) || requestUrl.host

  for (const header of HOP_BY_HOP_HEADERS) {
    headers.delete(header)
  }

  headers.set('x-forwarded-host', forwardedHost)
  headers.set('x-forwarded-proto', requestUrl.protocol.replace(':', ''))
  headers.delete(GROUPHER_COMMUNITY_SLUG_HEADER)
  if (target.communitySlug) {
    headers.set(GROUPHER_COMMUNITY_SLUG_HEADER, target.communitySlug)
  }

  if (target.requestHeaderPolicy === 'graphql-browser-clean') {
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

  if (target.requestHeaderPolicy === 'public-output') {
    headers.delete('authorization')
    headers.delete('cookie')
  }

  return headers
}

/** Builds proxy response from typed gateway inputs. */
export const buildProxyResponse = (response: Response): Response => {
  const headers = new Headers(response.headers)

  for (const header of AUTO_DECODED_RESPONSE_HEADERS) {
    headers.delete(header)
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/** Runs the proxy request operation at the gateway boundary. */
export const proxyRequest = async (
  request: Request,
  target: TGatewayTarget,
  { fetcher = fetch }: TProxyOptions = {},
): Promise<Response> => {
  const init: TNodeRequestInit = {
    method: request.method,
    headers: buildProxyHeaders(request, target),
    redirect: 'manual',
  }

  if (target.requiresBodyProxy) {
    init.body = request.body
    init.duplex = 'half'
  }

  const response = await fetcher(target.targetUrl, init)
  return buildProxyResponse(response)
}
