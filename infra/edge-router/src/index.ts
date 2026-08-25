import { GROUPHER_AUTH_CSRF_HEADER, GROUPHER_AUTH_CSRF_VALUE } from '@groupher/contracts/auth'
import { SERVICE_HEALTH_SCHEMA_VERSION } from '@groupher/contracts/health'
import { resolvePublicRoute, type PublicRoute } from '@groupher/route-contract'

import { buildProxyHeaders } from './headers'

let startedAt: number | undefined

const notFound = (): Response => new Response('Not Found', { status: 404 })

const invalidGraphQLRequest = (message: string): Response =>
  Response.json({ errors: [{ extensions: { code: 'INVALID_CSRF' }, message }] }, { status: 400 })

const validateGraphQLRequest = (request: Request, target: PublicRoute): Response | null => {
  if (target.requestHeaderPolicy !== 'graphql-browser-clean' || request.method !== 'POST') {
    return null
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return invalidGraphQLRequest('JSON is required.')
  }
  if (request.headers.get(GROUPHER_AUTH_CSRF_HEADER) !== GROUPHER_AUTH_CSRF_VALUE) {
    return invalidGraphQLRequest('CSRF proof is required.')
  }
  return null
}

const readCustomDomains = (value: string): Record<string, string> => {
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, string>)
      : {}
  } catch {
    return {}
  }
}

const targetUrl = (base: string, pathname: string, search: string): URL => {
  const url = new URL(base)
  url.pathname = pathname
  url.search = search
  return url
}

const proxyRequest = async (request: Request, target: PublicRoute, env: Env): Promise<Response> => {
  const incomingUrl = new URL(request.url)
  const headers = buildProxyHeaders(request, target.requestHeaderPolicy, target.communitySlug)
  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  }
  if (!['GET', 'HEAD'].includes(request.method.toUpperCase())) {
    init.body = request.body
    ;(init as RequestInit & { duplex: 'half' }).duplex = 'half'
  }

  if (
    target.targetKind === 'landing' ||
    target.targetKind === 'community' ||
    target.targetKind === 'auth'
  ) {
    const binding =
      target.targetKind === 'landing'
        ? env.LANDING
        : target.targetKind === 'community'
          ? env.COMMUNITY
          : env.AUTH
    incomingUrl.pathname = target.pathname
    return binding.fetch(new Request(incomingUrl, init))
  }

  const base = target.targetKind === 'phoenix' ? env.API_SITE : env.PRESS_SITE
  return fetch(new Request(targetUrl(base, target.pathname, incomingUrl.search), init))
}

const healthResponse = (env: Env): Response => {
  const now = Date.now()
  startedAt ??= now

  return Response.json({
    schemaVersion: SERVICE_HEALTH_SCHEMA_VERSION,
    status: 'ok',
    service: 'edge-router',
    version: env.CF_VERSION_METADATA.id,
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptimeMs: now - startedAt,
    checks: [],
  })
}

export default {
  async fetch(request, env): Promise<Response> {
    const requestStartedAt = Date.now()
    const url = new URL(request.url)
    const target = resolvePublicRoute({
      hostname: url.hostname,
      pathname: url.pathname,
      method: request.method,
      customDomainCommunities: readCustomDomains(env.CUSTOM_DOMAIN_COMMUNITIES),
    })

    try {
      const response =
        target.targetKind === 'health'
          ? healthResponse(env)
          : target.targetKind === 'not-found'
            ? notFound()
            : validateGraphQLRequest(request, target) || (await proxyRequest(request, target, env))

      console.log(
        JSON.stringify({
          event: 'edge_router_request',
          hostname: url.hostname,
          method: request.method,
          routeClass: target.routeClass,
          target: target.targetKind,
          status: response.status,
          durationMs: Date.now() - requestStartedAt,
        }),
      )
      return response
    } catch (error) {
      console.error(
        JSON.stringify({
          event: 'edge_router_request_error',
          hostname: url.hostname,
          method: request.method,
          routeClass: target.routeClass,
          target: target.targetKind,
          durationMs: Date.now() - requestStartedAt,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
      )
      throw error
    }
  },
} satisfies ExportedHandler<Env>
