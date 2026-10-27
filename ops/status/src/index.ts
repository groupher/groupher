import {
  SERVICE_HEALTH_SCHEMA_VERSION,
  type TServiceHealthResponseV1,
} from '@groupher/contracts/health'

import { checkAll, type ProbeBindings } from './probes'
import { readStatuses, saveResults } from './state'
import { renderPage, statusPayload } from './view'

type Env = ProbeBindings & {
  CF_VERSION_METADATA?: WorkerVersionMetadata
  DB: D1Database
  ENVIRONMENT?: string
}

const workerStartedAt = Date.now()

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
      const health: TServiceHealthResponseV1 = {
        schemaVersion: SERVICE_HEALTH_SCHEMA_VERSION,
        status: 'ok',
        service: 'status',
        version: env.CF_VERSION_METADATA?.id ?? 'unknown',
        environment: env.ENVIRONMENT ?? 'unknown',
        timestamp: new Date().toISOString(),
        uptimeMs: Date.now() - workerStartedAt,
        checks: [],
      }
      return Response.json(health, { headers: responseHeaders })
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
      if (path === '/api/status') {
        return Response.json(
          { error: 'status_unavailable', message: 'Status temporarily unavailable' },
          { status: 503, headers: responseHeaders },
        )
      }
      return new Response('Status temporarily unavailable', {
        status: 503,
        headers: { ...responseHeaders, 'content-type': 'text/plain; charset=utf-8' },
      })
    }
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const results = await checkAll(env)
    await saveResults(env.DB, results, new Date())
    console.log(JSON.stringify({ event: 'status_check', results }))
  },
}
