import { createHash, randomUUID } from 'node:crypto'

import { sql } from 'drizzle-orm'
import { isbot } from 'isbot'

import type { PressDatabase } from './db/client'
import { pressMetricEvents, pressMetricHourly } from './db/schema'
import type { OutputKind, Thread } from './types'

export type BotFamily = 'googlebot' | 'bingbot' | 'openai' | 'anthropic' | 'others' | 'unknown'

export type MetricEvent = {
  requestTimeUtc: Date
  communityRef: string
  thread?: Thread
  contentRef?: string
  outputKind: OutputKind
  statusCode: number
  cacheStatus: 'hit' | 'miss' | 'stale' | 'bypass'
  durationMs: number
  originDurationMs: number
  renderDurationMs: number
  responseBytes: number
  botFamily: BotFamily
  uaFamily?: string
  clientIpHash?: string
  requestId: string
  revision?: string
}

export const classifyBot = (userAgent = ''): BotFamily => {
  if (!userAgent) return 'unknown'
  if (/Googlebot/i.test(userAgent)) return 'googlebot'
  if (/bingbot/i.test(userAgent)) return 'bingbot'
  if (/GPTBot|ChatGPT-User|OAI-SearchBot/i.test(userAgent)) return 'openai'
  if (/ClaudeBot|Claude-User|Claude-SearchBot|anthropic-ai/i.test(userAgent)) return 'anthropic'
  return isbot(userAgent) ? 'others' : 'unknown'
}

export const classifyUa = (userAgent = ''): string | undefined => {
  if (/curl/i.test(userAgent)) return 'curl'
  if (/wget/i.test(userAgent)) return 'cli'
  if (/Chrome|Chromium/i.test(userAgent)) return 'chromium'
  if (/Mozilla/i.test(userAgent)) return 'web'
  if (userAgent) return 'http-client'
  return undefined
}

export const hashClientIp = (
  ip: string | undefined,
  salt = process.env.METRIC_IP_SALT,
): string | undefined => {
  if (!ip || !salt) return undefined
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 24)
}

export const requestId = (header?: string): string => header || randomUUID()

export const createMetricRecorder = (db: PressDatabase | null) => ({
  record(event: MetricEvent): void {
    if (!db) return
    void persistMetric(db, event).catch((error) =>
      console.error('Press metric write failed', error),
    )
  },
})

export const persistMetric = async (db: PressDatabase, event: MetricEvent): Promise<void> => {
  await db.insert(pressMetricEvents).values(event)
  const hour = new Date(event.requestTimeUtc)
  hour.setUTCMinutes(0, 0, 0)

  await db
    .insert(pressMetricHourly)
    .values({
      hourBucket: hour,
      communityRef: event.communityRef,
      thread: event.thread || '',
      contentRef: event.contentRef || '',
      outputKind: event.outputKind,
      statusCode: event.statusCode,
      cacheStatus: event.cacheStatus,
      botFamily: event.botFamily,
      requestsTotal: 1,
      responseBytesTotal: event.responseBytes,
      durationMsTotal: event.durationMs,
    })
    .onConflictDoUpdate({
      target: [
        pressMetricHourly.hourBucket,
        pressMetricHourly.communityRef,
        pressMetricHourly.thread,
        pressMetricHourly.contentRef,
        pressMetricHourly.outputKind,
        pressMetricHourly.statusCode,
        pressMetricHourly.cacheStatus,
        pressMetricHourly.botFamily,
      ],
      set: {
        requestsTotal: sql`${pressMetricHourly.requestsTotal} + 1`,
        responseBytesTotal: sql`${pressMetricHourly.responseBytesTotal} + ${event.responseBytes}`,
        durationMsTotal: sql`${pressMetricHourly.durationMsTotal} + ${event.durationMs}`,
      },
    })
}
