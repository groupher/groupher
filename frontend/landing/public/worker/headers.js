import { GROUPHER_AUTH_TOKEN_COOKIE, HOP_BY_HOP_HEADERS } from './config.js'

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

  if (target.requestHeaderPolicy === 'public-output') {
    headers.delete('authorization')
    headers.delete('cookie')
  }

  return headers
}
