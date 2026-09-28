/**
 * Owns ArticleStats fetching, owner-wise merge, and cache targeting.
 *
 *   detail/batch response or committed mutation payload
 *     -> normalize ArticleStats
 *     -> merge views / interaction / comments owners by revision
 *     -> patch only existing matching TanStack queries
 *
 * Equal-revision field conflicts retain current data, emit telemetry, and mark the affected query
 * stale. This module never writes aggregate fields into Article content caches.
 */
import type { ResultOf } from '@graphql-typed-document-node/core'
import { ARTICLE_STATS_CACHE_POLICY } from '@groupher/contracts/article-stats'
import type { QueryClient, QueryKey } from '@tanstack/react-query'

import { browserGraphQLRequest } from '~/graphql/client'
import { articleStats as articleStatsDocument } from '~/schemas/pages/articleStats'
import type { TArticleStats, TArticleThread, TThread } from '~/spec'

import { articlePathKey } from './articlePath'
import { normalizeArticleStats } from './articleStatsNormalize'
import { markStale } from './invalidation/executor'
import { articleQueryKeys } from './key'

export { normalizeArticleStats } from './articleStatsNormalize'

export const ARTICLE_STATS_SNAPSHOT_MAX_AGE_MS =
  ARTICLE_STATS_CACHE_POLICY.snapshotMaxAgeSeconds * 1_000

type TArticleStatsTelemetryEvent = 'clock_skew' | 'invalid_snapshot' | 'owner_conflict'

const VIEW_FIELDS = ['views'] as const
const INTERACTION_FIELDS = ['upvotesCount', 'collectsCount', 'emotionCounts'] as const
const COMMENT_FIELDS = ['commentsCount', 'commentsParticipantsCount'] as const

const reportArticleStatsTelemetry = (
  event: TArticleStatsTelemetryEvent,
  details: Record<string, unknown>,
): void => {
  if (typeof console === 'undefined') return
  console.warn(`[ArticleStats] ${event}`, details)
}

/** Reports whether a public ArticleStats snapshot has exceeded the cache freshness window. */
export const isArticleStatsSnapshotStale = (snapshotAt: string, now = Date.now()): boolean => {
  const snapshotTime = Date.parse(snapshotAt)
  if (!Number.isFinite(snapshotTime)) return true
  const rawAge = now - snapshotTime
  if (rawAge < 0) reportArticleStatsTelemetry('clock_skew', { snapshotAt })
  const age = rawAge < ARTICLE_STATS_CACHE_POLICY.clockSkewToleranceSeconds * 1_000 ? 0 : rawAge
  return age >= ARTICLE_STATS_SNAPSHOT_MAX_AGE_MS
}

const sameValue = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right)

const ownerChanged = <K extends keyof TArticleStats>(
  current: TArticleStats,
  incoming: TArticleStats,
  fields: readonly K[],
): boolean => fields.some((field) => !sameValue(current[field], incoming[field]))

const mergeOwner = <K extends keyof TArticleStats>(
  current: TArticleStats,
  incoming: TArticleStats,
  revision: 'viewsRevision' | 'interactionRevision' | 'commentsRevision',
  fields: readonly K[],
): { value: TArticleStats; advanced: boolean; conflict: boolean } => {
  if (incoming[revision] < current[revision]) {
    return { value: current, advanced: false, conflict: false }
  }

  if (incoming[revision] === current[revision]) {
    const conflict = ownerChanged(current, incoming, fields)
    if (conflict) {
      reportArticleStatsTelemetry('owner_conflict', {
        article: articlePathKey(current),
        revision,
        value: current[revision],
      })
    }
    return { value: current, advanced: false, conflict }
  }

  const value = { ...current, [revision]: incoming[revision] }
  for (const field of fields) value[field] = incoming[field]
  return { value, advanced: true, conflict: false }
}

const laterSnapshot = (current: string, incoming: string): string => {
  const currentAt = Date.parse(current)
  const incomingAt = Date.parse(incoming)
  if (!Number.isFinite(incomingAt)) {
    reportArticleStatsTelemetry('invalid_snapshot', { snapshotAt: incoming })
    return current
  }
  if (!Number.isFinite(currentAt)) return incoming
  return incomingAt > currentAt ? incoming : current
}

export type TArticleStatsMerge = {
  stats: TArticleStats
  conflict: boolean
}

/**
 * Merges the three ArticleStats owners independently by their monotonic revisions.
 *
 * A regressing owner is ignored without hiding advances from other owners. Equal revisions with
 * different fields are reported as conflicts because the backend contract requires every visible
 * owner change to advance its revision.
 */
export const mergeArticleStats = (
  current: TArticleStats | undefined,
  incoming: TArticleStats,
): TArticleStatsMerge => {
  if (!current) {
    if (!Number.isFinite(Date.parse(incoming.snapshotAt))) {
      reportArticleStatsTelemetry('invalid_snapshot', { snapshotAt: incoming.snapshotAt })
    }
    return { stats: incoming, conflict: false }
  }

  const views = mergeOwner(current, incoming, 'viewsRevision', VIEW_FIELDS)
  const interaction = mergeOwner(views.value, incoming, 'interactionRevision', INTERACTION_FIELDS)
  const comments = mergeOwner(interaction.value, incoming, 'commentsRevision', COMMENT_FIELDS)
  const advanced = views.advanced || interaction.advanced || comments.advanced
  const invalidSnapshot = advanced && !Number.isFinite(Date.parse(incoming.snapshotAt))

  return {
    stats: advanced
      ? { ...comments.value, snapshotAt: laterSnapshot(current.snapshotAt, incoming.snapshotAt) }
      : comments.value,
    conflict: views.conflict || interaction.conflict || comments.conflict || invalidSnapshot,
  }
}

const markConflictStaleAfterCommit = (queryClient: QueryClient, queryKey: QueryKey): void => {
  queueMicrotask(() => void markStale(queryClient, queryKey))
}

/** Creates structural sharing for a real detail query while preserving owner revision monotonicity. */
export const articleStatsStructuralSharing =
  (queryClient: QueryClient, queryKey: QueryKey) =>
  (current: TArticleStats | undefined, incoming: TArticleStats): TArticleStats => {
    const merged = mergeArticleStats(current, incoming)
    if (merged.conflict) markConflictStaleAfterCommit(queryClient, queryKey)
    return merged.stats
  }

/** Creates structural sharing for a batch query and merges every returned Article independently. */
export const articleStatsBatchStructuralSharing =
  (queryClient: QueryClient, queryKey: QueryKey) =>
  (current: TArticleStats[] | undefined, incoming: TArticleStats[]): TArticleStats[] => {
    if (!current) return incoming

    const currentByRef = new Map(current.map((item) => [articlePathKey(item), item]))
    let conflict = false
    const stats = incoming.map((item) => {
      const merged = mergeArticleStats(currentByRef.get(articlePathKey(item)), item)
      conflict ||= merged.conflict
      return merged.stats
    })

    if (conflict) markConflictStaleAfterCommit(queryClient, queryKey)
    return stats
  }

const sameArticle = (left: TArticleStats, right: TArticleStats): boolean =>
  left.community === right.community &&
  left.thread === right.thread &&
  String(left.innerId) === String(right.innerId)

const isStats = (queryKey: readonly unknown[]): boolean =>
  queryKey[0] === articleQueryKeys.all[0] &&
  queryKey[1] === 'article-stats' &&
  typeof queryKey[2] === 'string' &&
  typeof queryKey[3] === 'string' &&
  typeof queryKey[4] === 'string'

const isStatsBatch = (queryKey: readonly unknown[]): boolean =>
  queryKey[0] === articleQueryKeys.all[0] &&
  queryKey[1] === 'article-stats' &&
  typeof queryKey[2] === 'string' &&
  typeof queryKey[3] === 'string' &&
  Array.isArray(queryKey[4])

type TArticleStatsPath = {
  community: string
  thread: TThread
  innerId: string | number
}

const contains = (queryKey: readonly unknown[], path: TArticleStatsPath): boolean =>
  (isStats(queryKey) &&
    queryKey[2] === path.community &&
    queryKey[3] === path.thread &&
    queryKey[4] === String(path.innerId)) ||
  (isStatsBatch(queryKey) &&
    queryKey[2] === path.community &&
    queryKey[3] === path.thread &&
    (queryKey[4] as unknown[]).map(String).includes(String(path.innerId)))

const queries = (queryClient: QueryClient, path: TArticleStatsPath) =>
  queryClient.getQueryCache().findAll({ predicate: ({ queryKey }) => contains(queryKey, path) })

const apply = (queryClient: QueryClient, incoming: TArticleStats): void => {
  const matchingQueries = queries(queryClient, incoming)

  for (const query of matchingQueries) {
    const updatedAt = query.state.dataUpdatedAt
    let conflict = false
    queryClient.setQueryData<TArticleStats | TArticleStats[]>(
      query.queryKey,
      (current) => {
        if (Array.isArray(current)) {
          return current.map((item) => {
            if (!sameArticle(item, incoming)) return item
            const merged = mergeArticleStats(item, incoming)
            conflict ||= merged.conflict
            return merged.stats
          })
        }
        if (!current || !sameArticle(current, incoming)) return current
        const merged = mergeArticleStats(current, incoming)
        conflict ||= merged.conflict
        return merged.stats
      },
      { updatedAt },
    )
    if (conflict) {
      void markStale(queryClient, query.queryKey)
    }
  }
}

const find = (queryClient: QueryClient, path: TArticleStatsPath): TArticleStats | undefined => {
  const detail = queryClient.getQueryData<TArticleStats>(
    articleQueryKeys.stats(path.community, path.thread, path.innerId),
  )
  if (detail) return detail

  for (const query of queries(queryClient, path)) {
    if (!isStatsBatch(query.queryKey)) continue
    const match = queryClient
      .getQueryData<TArticleStats[]>(query.queryKey)
      ?.find((item) => String(item.innerId) === String(path.innerId))
    if (match) return match
  }
  return undefined
}

/**
 * Locates and patches only existing detail/batch ArticleStats queries for one path.
 *
 * `apply` uses functional updates and preserves each query's `dataUpdatedAt`; it never creates a
 * mutation-only entity key. `find` may inspect both real detail and batch cache entries.
 */
export const articleStatsCache = { contains, find, apply, queries } as const

const normalizeIds = (innerIds: readonly (string | number)[]): string[] =>
  [...new Set(innerIds.map(String))].sort()

const fetchArticleStats = async (
  community: string,
  thread: TArticleThread,
  innerIds: readonly string[],
  signal?: AbortSignal,
): Promise<TArticleStats[]> => {
  if (innerIds.length === 0) return []
  const data = (await browserGraphQLRequest(
    articleStatsDocument,
    { community, thread, innerIds: [...innerIds] },
    { signal },
  )) as unknown as ResultOf<typeof articleStatsDocument>
  return (data.articleStats || []).map(normalizeArticleStats)
}

/** Fetches one real public batch with shared normalization and owner-wise structural sharing. */
export const articleStatsBatch = (
  queryClient: QueryClient,
  community: string,
  thread: TArticleThread,
  innerIds: readonly (string | number)[],
) => {
  const normalizedIds = normalizeIds(innerIds)
  const queryKey = articleQueryKeys.statsBatch(community, thread, normalizedIds)
  return {
    queryKey,
    queryFn: ({ signal }: { signal?: AbortSignal }) =>
      fetchArticleStats(community, thread, normalizedIds, signal),
    enabled: Boolean(community && thread && normalizedIds.length),
    staleTime: ARTICLE_STATS_SNAPSHOT_MAX_AGE_MS,
    meta: { hydration: 'public' },
    structuralSharing: articleStatsBatchStructuralSharing(queryClient, queryKey),
  }
}

/** Fetches the real single-Article detail query; list batches remain independent cache entries. */
export const articleStats = (
  queryClient: QueryClient,
  community: string,
  thread: TArticleThread,
  innerId: string | number,
) => {
  const normalizedId = String(innerId)
  const queryKey = articleQueryKeys.stats(community, thread, normalizedId)
  return {
    queryKey,
    queryFn: async ({ signal }: { signal?: AbortSignal }) => {
      const stats = await fetchArticleStats(community, thread, [normalizedId], signal)
      const articleStats = stats[0]
      if (!articleStats) {
        throw new Error(`ArticleStats unavailable for ${community}:${thread}:${normalizedId}`)
      }
      return articleStats
    },
    enabled: Boolean(community && thread && normalizedId),
    staleTime: ARTICLE_STATS_SNAPSHOT_MAX_AGE_MS,
    meta: { hydration: 'public' },
    structuralSharing: articleStatsStructuralSharing(queryClient, queryKey),
  }
}
