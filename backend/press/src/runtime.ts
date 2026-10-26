/**
 * Runs Press HTTP handlers with invocation-owned database resources.
 *
 * Business position:
 *
 *   Worker or Node request
 *     -> pg.Client + Press app
 *     -> response and awaited cleanup
 */
import { Client } from 'pg'

import { createApp } from './app'
import { createDatabase } from './db/client'
import { persistMetric, type MetricEvent } from './metrics'

export type PressRuntimeEnvironment = {
  HYPERDRIVE?: { connectionString: string }
  DATABASE_URL?: string
  PHOENIX_GRAPHQL_ENDPOINT?: string
  PHOENIX_PRESS_RESOURCE?: string
  SERVICE_AUTH_ISSUER?: string
  SERVICE_AUTH_JWKS_URL?: string
  SERVICE_AUTH_TOKEN_ENDPOINT?: string
  SERVICE_AUTH_CLIENT_ID?: string
  SERVICE_AUTH_CLIENT_SECRET?: string
  METRIC_IP_SALT?: string
  PRESS_PUBLIC_DISABLED?: string
}

export type WaitUntil = (promise: Promise<unknown>) => void

/** Waits for request metrics to settle before releasing the invocation client. */
export const finishPressRequest = async (
  client: Pick<Client, 'end'>,
  pendingMetrics: Promise<unknown>[],
): Promise<void> => {
  try {
    await Promise.allSettled(pendingMetrics)
  } finally {
    await client.end()
  }
}

const logMetricFailure = (error: unknown): void => {
  console.error(
    JSON.stringify({
      event: 'press_metric_write_failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }),
  )
}

/** Runs one request with an invocation-owned Postgres client. */
export const handlePressRequest = async (
  request: Request,
  environment: PressRuntimeEnvironment,
  options: { routes: 'internal' | 'public'; waitUntil?: WaitUntil },
): Promise<Response> => {
  const connectionString = environment.HYPERDRIVE?.connectionString || environment.DATABASE_URL
  if (!connectionString) {
    return new Response('Press database is unavailable.\n', {
      headers: { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' },
      status: 503,
    })
  }

  const client = new Client({ connectionString })
  const pendingMetrics: Promise<void>[] = []
  let response: Response

  try {
    await client.connect()
    const database = createDatabase(client)
    const appEnvironment = {
      DATABASE_URL: environment.DATABASE_URL,
      PHOENIX_GRAPHQL_ENDPOINT: environment.PHOENIX_GRAPHQL_ENDPOINT,
      PHOENIX_PRESS_RESOURCE: environment.PHOENIX_PRESS_RESOURCE,
      SERVICE_AUTH_ISSUER: environment.SERVICE_AUTH_ISSUER,
      SERVICE_AUTH_JWKS_URL: environment.SERVICE_AUTH_JWKS_URL,
      SERVICE_AUTH_TOKEN_ENDPOINT: environment.SERVICE_AUTH_TOKEN_ENDPOINT,
      SERVICE_AUTH_CLIENT_ID: environment.SERVICE_AUTH_CLIENT_ID,
      SERVICE_AUTH_CLIENT_SECRET: environment.SERVICE_AUTH_CLIENT_SECRET,
      METRIC_IP_SALT: environment.METRIC_IP_SALT,
      PRESS_PUBLIC_DISABLED: environment.PRESS_PUBLIC_DISABLED,
    }
    const app = createApp({
      database,
      environment: appEnvironment,
      routes: options.routes,
      recorder: {
        record(event: MetricEvent) {
          const pending = persistMetric(database, event).catch((error: unknown) => {
            logMetricFailure(error)
          })
          pendingMetrics.push(pending)
          return pending
        },
      },
    })
    response = await app.fetch(request)
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'press_request_failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    )
    response = new Response('Press origin unavailable.\n', {
      headers: { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' },
      status: 503,
    })
  }

  if (pendingMetrics.length > 0 && options.waitUntil) {
    options.waitUntil(finishPressRequest(client, pendingMetrics))
  } else {
    await finishPressRequest(client, pendingMetrics)
  }

  return response
}
