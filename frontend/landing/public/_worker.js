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

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/health') {
      return json({
        schemaVersion: 'health.v1',
        status: 'ok',
        service: 'landing-cloudflare-router',
        environment: env.ENVIRONMENT || 'production',
        timestamp: new Date().toISOString(),
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

    return proxyRequest(request, target, env.fetcher || fetch)
  },
}
