import { sql } from 'drizzle-orm'

import type { PressDatabase } from './client'

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

export const startRetention = (db: PressDatabase | null): void => {
  if (!db) return

  const run = () =>
    void applyRetention(db).catch((error) => console.error('Press retention failed', error))
  run()
  setInterval(run, 24 * 60 * 60_000).unref()
}
