import { getPhoenixToken } from '~/app/phoenix-token'

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

const proxyHeaders = (request: Request): Headers => {
  const headers = new Headers(request.headers)

  for (const header of HOP_BY_HOP_HEADERS) headers.delete(header)
  headers.delete('cookie')
  headers.delete('host')

  const token = getPhoenixToken(request)
  if (token) headers.set('authorization', `Bearer ${token}`)

  return headers
}

const responseHeaders = (headers: Headers): Headers => {
  const nextHeaders = new Headers(headers)
  for (const header of HOP_BY_HOP_HEADERS) nextHeaders.delete(header)
  return nextHeaders
}

/**
 * Proxies same-origin browser GraphQL requests to Phoenix.
 *
 * App route handlers in `frontend/main` and `frontend/dashboard` delegate to
 * this helper from `/api/graphql`. It strips browser cookies before forwarding,
 * verifies the canonical Groupher Phoenix token when present, and forwards that
 * token as `Authorization: Bearer <token>`. Anonymous requests remain anonymous.
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
