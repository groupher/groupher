import {
  GROUPHER_AUTH_CSRF_HEADER,
  GROUPHER_AUTH_CSRF_VALUE,
  GROUPHER_AUTH_TOKEN_COOKIE,
} from '@groupher/contracts/auth'

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

const configuredGraphQLEndpoint = (): URL | Response => {
  const value = process.env.GRAPHQL_ENDPOINT?.trim()
  if (!value) {
    return Response.json(
      { errors: [{ message: 'GRAPHQL_ENDPOINT is not configured.' }] },
      { status: 500 },
    )
  }

  try {
    return new URL(value)
  } catch {
    return Response.json(
      { errors: [{ message: 'GRAPHQL_ENDPOINT is not configured correctly.' }] },
      { status: 500 },
    )
  }
}

const requestBody = async (request: Request): Promise<ArrayBuffer | undefined> => {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined
  return request.arrayBuffer()
}

const readCookie = (headers: Headers, name: string): string | null => {
  const cookieHeader = headers.get('cookie')
  if (!cookieHeader) return null

  for (const cookie of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = cookie.trim().split('=')
    if (rawName === name) return rawValue.join('=')
  }

  return null
}

const proxyHeaders = (request: Request): Headers => {
  // Do not relay platform/client forwarding metadata to Phoenix. On Vercel,
  // forwarding every incoming header can exceed the upstream header limit and
  // turn an otherwise valid GraphQL request into HTTP 431.
  const headers = new Headers()
  const authToken = readCookie(request.headers, GROUPHER_AUTH_TOKEN_COOKIE)

  for (const name of ['accept', 'content-type', 'origin', GROUPHER_AUTH_CSRF_HEADER]) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }

  if (authToken) {
    headers.set('cookie', `${GROUPHER_AUTH_TOKEN_COOKIE}=${authToken}`)
  }

  return headers
}

const responseHeaders = (headers: Headers): Headers => {
  const nextHeaders = new Headers(headers)
  for (const header of HOP_BY_HOP_HEADERS) nextHeaders.delete(header)
  // Fetch transparently decodes an upstream compressed response before its body
  // reaches this route handler. Forwarding the original encoding would make the
  // browser attempt a second decode and fail the GraphQL request.
  nextHeaders.delete('content-encoding')
  return nextHeaders
}

/**
 * Proxies same-origin browser GraphQL requests to Phoenix.
 *
 * TanStack server routes delegate to this helper from `/api/graphql`. It strips
 * browser credentials before
 * forwarding, then only forwards the canonical Groupher Phoenix token as the
 * same cookie Phoenix reads. Anonymous requests remain anonymous.
 *
 * @example
 * ```ts
 * import { proxyGraphQLRequest } from '~/graphql/proxy'
 *
 * export const GET = (request: Request) => proxyGraphQLRequest(request)
 * export const POST = (request: Request) => proxyGraphQLRequest(request)
 * ```
 */
export const proxyGraphQLRequest = async (
  request: Request,
  fetcher: typeof fetch = fetch,
): Promise<Response> => {
  if (request.method === 'POST') {
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.startsWith('application/json')) {
      return Response.json(
        { errors: [{ extensions: { code: 'INVALID_REQUEST' }, message: 'JSON is required.' }] },
        { status: 400 },
      )
    }
    if (request.headers.get(GROUPHER_AUTH_CSRF_HEADER) !== GROUPHER_AUTH_CSRF_VALUE) {
      return Response.json(
        { errors: [{ extensions: { code: 'INVALID_CSRF' }, message: 'CSRF proof is required.' }] },
        { status: 400 },
      )
    }
  }

  const endpoint = configuredGraphQLEndpoint()
  if (endpoint instanceof Response) return endpoint

  const requestUrl = new URL(request.url)
  const targetUrl = new URL(endpoint)
  targetUrl.search = requestUrl.search

  const response = await fetcher(targetUrl, {
    body: await requestBody(request),
    cache: 'no-store',
    headers: proxyHeaders(request),
    method: request.method,
  })

  return new Response(response.body, {
    headers: responseHeaders(response.headers),
    status: response.status,
    statusText: response.statusText,
  })
}
