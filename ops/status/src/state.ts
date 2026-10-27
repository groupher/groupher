import type { ProbeResult } from './probes'

export type State = 'up' | 'degraded' | 'down'

export type StatusRow = {
  id: string
  state: State
  streak: number
  response_ms: number | null
  checked_at: string
}

export function nextState(
  previous: StatusRow | undefined,
  ok: boolean,
): Pick<StatusRow, 'state' | 'streak'> {
  if (!ok) {
    const streak = Math.min(0, previous?.streak ?? 0) - 1
    return { state: streak <= -3 ? 'down' : 'degraded', streak }
  }

  const streak = Math.max(0, previous?.streak ?? 0) + 1
  return { state: previous?.state === 'down' && streak < 2 ? 'degraded' : 'up', streak }
}

export async function readStatuses(db: D1Database): Promise<Map<string, StatusRow>> {
  const rows = await db
    .prepare('SELECT id, state, streak, response_ms, checked_at FROM service_status')
    .all<StatusRow>()
  return new Map((rows.results || []).map((row) => [row.id, row]))
}

export async function saveResults(
  db: D1Database,
  results: ProbeResult[],
  now: Date,
): Promise<void> {
  const previous = await readStatuses(db)
  const checkedAt = now.toISOString()
  const statements = results.map((result) => {
    const next = nextState(previous.get(result.id), result.ok)
    return db
      .prepare(`INSERT INTO service_status (id, state, streak, response_ms, checked_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET state = excluded.state, streak = excluded.streak,
          response_ms = excluded.response_ms, checked_at = excluded.checked_at`)
      .bind(result.id, next.state, next.streak, result.responseMs, checkedAt)
  })
  await db.batch(statements)
}
