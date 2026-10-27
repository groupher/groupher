import { checkAll, type ProbeBindings } from './probes'
import { readStatuses, saveResults } from './state'
import { renderPage, statusPayload } from './view'

type Env = ProbeBindings & { DB: D1Database }

const responseHeaders = {
  'x-groupher-status-runtime': 'worker',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'content-security-policy':
    "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD')
      return new Response(null, { status: 405 })
    const path = new URL(request.url).pathname
    if (path === '/health') {
      return Response.json(
        { schemaVersion: 'health.v1', service: 'status', status: 'ok' },
        { headers: responseHeaders },
      )
    }
    if (path !== '/' && path !== '/api/status') return new Response(null, { status: 404 })

    try {
      const now = new Date()
      const rows = await readStatuses(env.DB)
      if (path === '/api/status')
        return Response.json(statusPayload(rows, now), { headers: responseHeaders })
      return new Response(request.method === 'HEAD' ? null : renderPage(rows, now), {
        headers: { ...responseHeaders, 'content-type': 'text/html; charset=utf-8' },
      })
    } catch (error) {
      console.error(JSON.stringify({ event: 'status_read_failed', error: String(error) }))
      return new Response('Status temporarily unavailable', {
        status: 503,
        headers: responseHeaders,
      })
    }
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const results = await checkAll(env)
    await saveResults(env.DB, results, new Date())
    console.log(JSON.stringify({ event: 'status_check', results }))
  },
}
