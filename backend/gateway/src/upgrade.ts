/**
 * Forwards WebSocket upgrades from Gateway to the selected upstream service.
 *
 * Business position:
 *
 *   Browser / service
 *     -> Gateway module
 *     -> selected Groupher application
 *     -> proxied response
 */

import type { IncomingMessage } from 'node:http'
import net from 'node:net'
import type { Duplex } from 'node:stream'
import tls from 'node:tls'

import { resolveGatewayTarget } from './routing'

type TUpgradeHeaders = IncomingMessage['headers']

const firstHeaderValue = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) return value[0]?.split(',')[0]?.trim() || null
  return value?.split(',')[0]?.trim() || null
}

/** Builds upgrade target url from typed gateway inputs. */
export const buildUpgradeTargetUrl = (request: IncomingMessage): URL => {
  const requestUrl = new URL(request.url || '/', 'http://gateway.local')
  const target = resolveGatewayTarget({
    pathname: requestUrl.pathname,
    search: requestUrl.search,
    method: request.method,
    host: request.headers.host || '',
    forwardedHost: firstHeaderValue(request.headers['x-forwarded-host']),
    referer: firstHeaderValue(request.headers.referer),
  })

  if (target.targetKind === 'not-found') {
    return new URL('http://gateway.invalid')
  }

  return target.targetUrl
}

/** Builds upgrade header lines from typed gateway inputs. */
export const buildUpgradeHeaderLines = (headers: TUpgradeHeaders, targetUrl: URL): string[] => {
  const forwardedHost =
    firstHeaderValue(headers['x-forwarded-host']) || firstHeaderValue(headers.host)
  const lines: string[] = []

  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue
    if (name.toLowerCase() === 'host') {
      lines.push(`host: ${targetUrl.host}`)
      continue
    }
    if (Array.isArray(value)) {
      for (const item of value) lines.push(`${name}: ${item}`)
      continue
    }
    lines.push(`${name}: ${value}`)
  }

  if (!headers.host) lines.push(`host: ${targetUrl.host}`)
  if (!headers['x-forwarded-host'] && forwardedHost) {
    lines.push(`x-forwarded-host: ${forwardedHost}`)
  }

  return lines
}

/** Runs the proxy upgrade request operation at the gateway boundary. */
export const proxyUpgradeRequest = (
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer,
): void => {
  const targetUrl = buildUpgradeTargetUrl(request)
  if (targetUrl.hostname === 'gateway.invalid') {
    socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n')
    return
  }
  const port = Number.parseInt(
    targetUrl.port || (targetUrl.protocol === 'https:' ? '443' : '80'),
    10,
  )
  const upstream =
    targetUrl.protocol === 'https:'
      ? tls.connect(port, targetUrl.hostname)
      : net.connect(port, targetUrl.hostname)

  upstream.once('connect', () => {
    const path = `${targetUrl.pathname}${targetUrl.search}`
    const requestLine = `${request.method || 'GET'} ${path} HTTP/${request.httpVersion}`
    const payload = `${[requestLine, ...buildUpgradeHeaderLines(request.headers, targetUrl)].join('\r\n')}\r\n\r\n`

    upstream.write(payload)
    if (head.length > 0) upstream.write(head)

    socket.pipe(upstream)
    upstream.pipe(socket)
  })

  upstream.once('error', () => socket.destroy())
  socket.once('error', () => upstream.destroy())
  socket.once('close', () => upstream.destroy())
}
