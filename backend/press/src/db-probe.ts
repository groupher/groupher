/**
 * Proves a Hyperdrive binding can read Press analysis tables without changing data.
 *
 * Business position:
 *
 *   Operator -> temporary authenticated Worker -> readonly Hyperdrive SQL -> client cleanup
 */
import { Client } from 'pg'

type ProbeEnvironment = {
  HYPERDRIVE: { connectionString: string }
  PROBE_TOKEN: string
}

export default {
  async fetch(request: Request, env: ProbeEnvironment): Promise<Response> {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/internal/probe') {
      return new Response('Not found\n', { status: 404 })
    }
    if (!env.PROBE_TOKEN || request.headers.get('authorization') !== `Bearer ${env.PROBE_TOKEN}`) {
      return new Response('Unauthorized\n', { status: 401 })
    }

    const client = new Client({
      connectionString: env.HYPERDRIVE.connectionString,
      connectionTimeoutMillis: 5_000,
    })
    try {
      await client.connect()
      const identity = await client.query(
        'SELECT current_user AS role, current_database() AS database, current_setting($1) AS timezone',
        ['timezone'],
      )
      await client.query('SELECT id FROM analysis.press_metric_events LIMIT 1')
      await client.query('SELECT hour_bucket FROM analysis.press_metric_hourly LIMIT 1')
      await client.query('SELECT key FROM analysis.press_output_cache LIMIT 1')
      return Response.json(
        { ok: true, ...identity.rows[0], checkedTables: 3 },
        { headers: { 'cache-control': 'no-store' } },
      )
    } catch {
      return Response.json(
        { ok: false, error: 'Press database probe failed' },
        { status: 503, headers: { 'cache-control': 'no-store' } },
      )
    } finally {
      await client.end()
    }
  },
} satisfies ExportedHandler<ProbeEnvironment>
