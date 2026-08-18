import { buildProxyHeaders, readCookie } from './worker/headers.js'
import { proxyRequest } from './worker/proxy.js'
import { json } from './worker/response.js'
import {
  isLandingPath,
  isLandingStaticAssetPath,
  isPressRoute,
  resolveCloudflareTarget,
} from './worker/routes.js'

export { buildProxyHeaders, isPressRoute, proxyRequest, readCookie, resolveCloudflareTarget }

const startedAt = Date.now()

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/health') {
      return json({
        schemaVersion: 'health.v1',
        status: 'ok',
        service: 'edge-router',
        version: env.CF_PAGES_COMMIT_SHA || 'dev',
        environment: env.ENVIRONMENT || 'production',
        timestamp: new Date().toISOString(),
        uptimeMs: Date.now() - startedAt,
        checks: [],
      })
    }

    if (isLandingPath(url.pathname) || isLandingStaticAssetPath(url.pathname)) {
      return env.ASSETS.fetch(request)
    }

    const target = resolveCloudflareTarget(
      {
        pathname: url.pathname,
        search: url.search,
      },
      env,
    )

    if (target.kind === 'not-found') return new Response('Not Found', { status: 404 })

    return proxyRequest(request, target, env.fetcher || fetch)
  },
}
