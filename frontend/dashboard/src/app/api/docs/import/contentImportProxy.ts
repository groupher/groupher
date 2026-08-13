import { dashboardToContentImportHeaders } from '../../../../lib/serviceAuth'

type TOptions = {
  backendToken: string
  fetcher?: typeof fetch
}

const serviceUnavailable = (message: string): Response =>
  Response.json(
    { error: { code: 'content_import_unavailable', message }, ok: false },
    { headers: { 'Cache-Control': 'no-store' }, status: 503 },
  )

const configuredContentImportUrl = (): URL | Response => {
  const value = process.env.CONTENT_IMPORT_APP_ENDPOINT?.trim()
  if (!value) return serviceUnavailable('Content Import endpoint is not configured.')

  try {
    return new URL(value)
  } catch {
    return serviceUnavailable('Content Import endpoint is not configured correctly.')
  }
}

const requestBody = async (request: Request): Promise<ArrayBuffer | undefined> => {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined
  return request.arrayBuffer()
}

/**
 * Proxies the stable Dashboard route to the standalone content-import service.
 */
export const proxyContentImportRequest = async (
  request: Request,
  { backendToken, fetcher = fetch }: TOptions,
): Promise<Response> => {
  const baseUrl = configuredContentImportUrl()
  if (baseUrl instanceof Response) return baseUrl

  const currentUrl = new URL(request.url)
  const targetUrl = new URL(`${currentUrl.pathname}${currentUrl.search}`, baseUrl)
  const headers = new Headers(request.headers)
  headers.delete('cookie')
  headers.delete('host')
  const serviceHeaders = await dashboardToContentImportHeaders(backendToken)
  for (const [name, value] of Object.entries(serviceHeaders)) headers.set(name, value)

  return fetcher(targetUrl, {
    body: await requestBody(request),
    cache: 'no-store',
    headers,
    method: request.method,
  })
}
