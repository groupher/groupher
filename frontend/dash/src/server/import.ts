import { GROUPHER_USER_AUTHORIZATION_HEADER } from '@groupher/contracts/headers'
import { createServiceAuthClientFromEnv, type TServiceAuthClient } from '@groupher/service/auth'

type TProxyOptions = {
  backendToken?: string | null
  fetcher?: typeof fetch
  serviceAuthClient?: TServiceAuthClient
}

let serviceAuthClient: TServiceAuthClient | undefined

const serviceUnavailable = (message: string): Response =>
  Response.json(
    { error: { code: 'import_unavailable', message }, ok: false },
    { headers: { 'Cache-Control': 'no-store' }, status: 503 },
  )

const configuredImportUrl = (): URL | Response => {
  const value = process.env.IMPORT_APP_ENDPOINT?.trim()
  if (!value) return serviceUnavailable('Import endpoint is not configured.')

  try {
    return new URL(value)
  } catch {
    return serviceUnavailable('Import endpoint is not configured correctly.')
  }
}

const requestBody = async (request: Request): Promise<ArrayBuffer | undefined> => {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined
  return request.arrayBuffer()
}

/** Proxies one authenticated Dash server request to the standalone Import service. */
export const proxyImportRequest = async (
  request: Request,
  { backendToken = null, fetcher = fetch, serviceAuthClient: injectedClient }: TProxyOptions = {},
): Promise<Response> => {
  const baseUrl = configuredImportUrl()
  if (baseUrl instanceof Response) return baseUrl

  const client =
    injectedClient || (serviceAuthClient ??= createServiceAuthClientFromEnv(process.env, fetcher))
  let token: string
  try {
    token = await client.getToken({
      resource: process.env.IMPORT_SERVICE_AUTH_RESOURCE || 'https://import.groupher.com/internal',
      scopes: (process.env.IMPORT_SERVICE_AUTH_SCOPES || 'docs:import:proxy')
        .split(/\s+/u)
        .filter(Boolean),
    })
  } catch {
    return serviceUnavailable('Dash service authentication is not configured.')
  }

  const currentUrl = new URL(request.url)
  const targetUrl = new URL(`${currentUrl.pathname}${currentUrl.search}`, baseUrl)
  const headers = new Headers(request.headers)
  headers.delete('cookie')
  headers.delete('host')
  headers.set('authorization', `Bearer ${token}`)
  if (backendToken) {
    headers.set(GROUPHER_USER_AUTHORIZATION_HEADER, `Bearer ${backendToken}`)
  } else {
    headers.delete(GROUPHER_USER_AUTHORIZATION_HEADER)
  }

  return fetcher(targetUrl, {
    body: await requestBody(request),
    cache: 'no-store',
    headers,
    method: request.method,
  })
}
