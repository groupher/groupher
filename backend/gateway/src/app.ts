/**
 * Composes the Gateway HTTP application and its injected route dependencies.
 *
 * Business position:
 *
 *   Browser / service
 *     -> Gateway module
 *     -> selected Groupher application
 *     -> proxied response
 */

import { GROUPHER_AUTH_CSRF_HEADER, GROUPHER_AUTH_CSRF_VALUE } from '@groupher/contracts/auth'
import { Hono } from 'hono'

import { buildHealthResponse } from './health.js'
import { proxyRequest } from './proxy.js'
import { isPlatformRootHost, resolveGatewayTarget } from './routing.js'
import { getPublicFile, readPublicFile } from './static.js'

type TOptions = {
  fetcher?: typeof fetch
}

const invalidGraphQLRequest = (message: string) =>
  Response.json({ errors: [{ extensions: { code: 'INVALID_CSRF' }, message }] }, { status: 400 })

const validateBrowserGraphQLRequest = (
  request: Request,
  target: ReturnType<typeof resolveGatewayTarget>,
) => {
  if (target.requestHeaderPolicy !== 'graphql-browser-clean' || request.method !== 'POST')
    return null
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return invalidGraphQLRequest('JSON is required.')
  }
  if (request.headers.get(GROUPHER_AUTH_CSRF_HEADER) !== GROUPHER_AUTH_CSRF_VALUE) {
    return invalidGraphQLRequest('CSRF proof is required.')
  }
  return null
}

/** Creates the Gateway application with injectable runtime dependencies. */
export const createApp = ({ fetcher }: TOptions = {}) => {
  const app = new Hono()
  /** Creates the gateway application with injectable runtime dependencies. */

  app.get('/health', (context) => context.json(buildHealthResponse()))

  app.get('/:file{robots\\.txt|sitemap\\.xml|manifest\\.json|favicon\\.ico}', async (context) => {
    const url = new URL(context.req.url)
    const routingHost = context.req.header('x-forwarded-host')?.split(',')[0]?.trim() || url.host
    if (!isPlatformRootHost(routingHost)) {
      const target = resolveGatewayTarget({
        pathname: url.pathname,
        search: url.search,
        method: context.req.method,
        host: url.host,
        forwardedHost: context.req.header('x-forwarded-host'),
      })
      return proxyRequest(context.req.raw, target, { fetcher })
    }

    const publicFile = getPublicFile(new URL(context.req.url).pathname)

    if (!publicFile) {
      return context.notFound()
    }

    const content = await readPublicFile(publicFile.fileName)
    return new Response(content, {
      headers: {
        'Cache-Control': 'public, max-age=300',
        'Content-Type': publicFile.contentType,
      },
    })
  })

  app.all('*', (context) => {
    const url = new URL(context.req.url)
    const target = resolveGatewayTarget({
      pathname: url.pathname,
      search: url.search,
      method: context.req.method,
      host: url.host,
      forwardedHost: context.req.header('x-forwarded-host'),
      referer: context.req.header('referer'),
    })

    const invalidRequest = validateBrowserGraphQLRequest(context.req.raw, target)
    return invalidRequest || proxyRequest(context.req.raw, target, { fetcher })
  })

  return app
}

export default createApp()
