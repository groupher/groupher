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

/** Runs the start retention operation at the press boundary. */
export const startRetention = (db: PressDatabase | null): void => {
  if (!db) return

  const run = () =>
    void applyRetention(db).catch((error) => console.error('Press retention failed', error))
  run()
  setInterval(run, 24 * 60 * 60_000).unref()
}
