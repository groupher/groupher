/**
 * Implements the Src Db Retention boundary inside Press.
 *
 * Business position:
 *
 *   Browser / Gateway
 *     -> Press module
 *     -> cache / Phoenix projection
 *     -> public response
 */

import { sql } from 'drizzle-orm'

import type { PressDatabase } from './client'

export type RetentionClient = {
  connect(): Promise<unknown>
  end(): Promise<unknown>
}

/** Owns the scheduled database connection and closes it on every result path. */
export const runRetentionWithClient = async <T extends RetentionClient>(
  client: T,
  run: (client: T) => Promise<void>,
): Promise<void> => {
  try {
    await client.connect()
    await run(client)
  } finally {
    await client.end()
  }
}

/** Runs the apply retention operation at the press boundary. */
export const applyRetention = async (db: PressDatabase): Promise<void> => {
  await db.execute(sql`
    DELETE FROM analysis.press_metric_events
    WHERE request_time_utc < now() - interval '7 days'
  `)
  await db.execute(sql`
    DELETE FROM analysis.press_metric_hourly
    WHERE hour_bucket < now() - interval '180 days'
  `)
  await db.execute(sql`
    DELETE FROM analysis.press_output_cache
    WHERE expires_at < now()
  `)
}
