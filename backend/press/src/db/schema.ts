import {
  bigint,
  bigserial,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

export const analysis = pgSchema('analysis')

export const pressMetricEvents = analysis.table(
  'press_metric_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    requestTimeUtc: timestamp('request_time_utc', { withTimezone: true, mode: 'date' }).notNull(),
    communityRef: text('community_ref').notNull(),
    thread: text('thread'),
    contentRef: text('content_ref'),
    outputKind: text('output_kind').notNull(),
    statusCode: integer('status_code').notNull(),
    cacheStatus: text('cache_status').notNull(),
    durationMs: integer('duration_ms').notNull(),
    originDurationMs: integer('origin_duration_ms').notNull().default(0),
    renderDurationMs: integer('render_duration_ms').notNull().default(0),
    responseBytes: bigint('response_bytes', { mode: 'number' }).notNull(),
    botFamily: text('bot_family').notNull(),
    uaFamily: text('ua_family'),
    clientIpHash: text('client_ip_hash'),
    requestId: text('request_id').notNull(),
    revision: text('revision'),
  },
  (table) => [
    index('press_metric_events_request_time_idx').on(table.requestTimeUtc),
    index('press_metric_events_community_content_idx').on(
      table.communityRef,
      table.contentRef,
      table.requestTimeUtc,
    ),
  ],
)

export const pressMetricHourly = analysis.table(
  'press_metric_hourly',
  {
    hourBucket: timestamp('hour_bucket', { withTimezone: true, mode: 'date' }).notNull(),
    communityRef: text('community_ref').notNull(),
    thread: text('thread').notNull().default(''),
    contentRef: text('content_ref').notNull().default(''),
    outputKind: text('output_kind').notNull(),
    statusCode: integer('status_code').notNull(),
    cacheStatus: text('cache_status').notNull(),
    botFamily: text('bot_family').notNull(),
    requestsTotal: bigint('requests_total', { mode: 'number' }).notNull().default(0),
    responseBytesTotal: bigint('response_bytes_total', { mode: 'number' }).notNull().default(0),
    durationMsTotal: bigint('duration_ms_total', { mode: 'number' }).notNull().default(0),
  },
  (table) => [
    primaryKey({
      columns: [
        table.hourBucket,
        table.communityRef,
        table.thread,
        table.contentRef,
        table.outputKind,
        table.statusCode,
        table.cacheStatus,
        table.botFamily,
      ],
      name: 'press_metric_hourly_pk',
    }),
  ],
)

export const pressOutputCache = analysis.table(
  'press_output_cache',
  {
    key: text('key').primaryKey(),
    status: integer('status').notNull(),
    body: text('body').notNull(),
    headers: jsonb('headers').$type<Record<string, string>>().notNull(),
    metadata: jsonb('metadata').$type<Record<string, string>>(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [index('press_output_cache_expires_idx').on(table.expiresAt)],
)
