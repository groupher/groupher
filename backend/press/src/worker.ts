/**
 * Exports private health/invalidation and public output entrypoints.
 *
 * Business position:
 *
 *   edge-router / Phoenix
 *     -> Worker default / named Public
 *     -> Press runtime
 */
import { createHealthResponse } from '@groupher/service/health'
import { WorkerEntrypoint } from 'cloudflare:workers'
import { Client } from 'pg'

import { createDatabase } from './db/client'
import { applyRetention, runRetentionWithClient } from './db/retention'
import { publicEntryDecision } from './public-entry-guard'
import { handlePressRequest } from './runtime'

const notFound = (): Response =>
  new Response('Not Found\n', {
    headers: { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' },
    status: 404,
  })

const disabled = (): Response =>
  new Response('Press public output is temporarily disabled.\n', {
    headers: {
      'cache-control': 'no-store',
      'content-type': 'text/plain; charset=utf-8',
      'retry-after': '60',
    },
    status: 503,
  })

const handleInvalidation = (request: Request, env: Env, ctx: ExecutionContext): Promise<Response> =>
  handlePressRequest(request, env, {
    routes: 'internal',
    waitUntil: (promise) => ctx.waitUntil(promise),
  })

export class Public extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    const pathname = new URL(request.url).pathname
    const decision = publicEntryDecision(pathname, this.env.PRESS_PUBLIC_DISABLED)
    if (decision === 'not-found') return notFound()
    if (decision === 'disabled') return disabled()

    return handlePressRequest(request, this.env, {
      routes: 'public',
      waitUntil: (promise) => this.ctx.waitUntil(promise),
    })
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json(createHealthResponse({ service: 'press' }), {
        headers: { 'cache-control': 'no-store' },
      })
    }
    if (request.method === 'POST' && url.pathname === '/internal/invalidate') {
      return handleInvalidation(request, env, ctx)
    }
    return notFound()
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const connectionString = env.HYPERDRIVE.connectionString
    const client = new Client({ connectionString, connectionTimeoutMillis: 5_000 })

    try {
      await runRetentionWithClient(client, (connection) =>
        applyRetention(createDatabase(connection)),
      )
    } catch (error) {
      console.error(
        JSON.stringify({
          event: 'press_retention_failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
      )
      throw error
    }
  },
}
