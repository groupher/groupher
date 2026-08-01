import { Hono } from 'hono'

import { buildHealthResponse } from './health.js'
import { proxyRequest } from './proxy.js'
import { resolveGatewayTarget } from './routing.js'
import { getPublicFile, readPublicFile } from './static.js'

type TOptions = {
  fetcher?: typeof fetch
}

export const createApp = ({ fetcher }: TOptions = {}) => {
  const app = new Hono()

  app.get('/health', (context) => context.json(buildHealthResponse()))

  app.get('/:file{robots\\.txt|sitemap\\.xml|manifest\\.json|favicon\\.ico}', async (context) => {
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

    return proxyRequest(context.req.raw, target, { fetcher })
  })

  return app
}

export default createApp()
