import type { ResultOf } from '@graphql-typed-document-node/core'
import { ARTICLE_STATS_CACHE_POLICY } from '@groupher/contracts/article-stats'
import type { QueryClient } from '@tanstack/react-query'

import { browserGraphQLRequest } from '~/graphql/client'
import { articleStats as articleStatsDocument } from '~/schemas/pages/articleStats'
import type { TArticleStats, TArticleThread, TThread } from '~/spec'

import { markStale } from './invalidation'
import { articleKeys } from './key'
import { getQueryClient } from './queryClient'

export type TArticleStatsResponse = ResultOf<typeof articleStatsDocument>['articleStats'][number]

/** Converts one GraphQL ArticleStats DTO into the canonical frontend entity shape. */
export const normalizeArticleStats = (stats: TArticleStatsResponse): TArticleStats => ({
  community: String(stats.community),
  thread: stats.thread as TThread,
  innerId: String(stats.innerId),
  views: Number(stats.views),
  viewsRevision: Number(stats.viewsRevision),
  upvotesCount: Number(stats.upvotesCount),
  commentsCount: Number(stats.commentsCount),
  collectsCount: Number(stats.collectsCount),
  commentsParticipantsCount: Number(stats.commentsParticipantsCount),
  interactionRevision: Number(stats.interactionRevision),
  commentsRevision: Number(stats.commentsRevision),
  emotionCounts: (stats.emotionCounts || []).map((emotion) => ({
    type: emotion.type,
    count: Number(emotion.count),
  })),
  snapshotAt: String(stats.snapshotAt),
})

export const ARTICLE_STATS_SNAPSHOT_MAX_AGE_MS =
  ARTICLE_STATS_CACHE_POLICY.snapshotMaxAgeSeconds * 1_000

type TArticleStatsTelemetryEvent = 'clock_skew' | 'invalid_snapshot' | 'mixed_snapshot'
const OWNER_REVISIONS = ['viewsRevision', 'interactionRevision', 'commentsRevision'] as const

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

const isOlderStats = (current: TArticleStats | undefined, incoming: TArticleStats): boolean => {
  const incomingAt = Date.parse(incoming.snapshotAt)
  const incomingTimestampValid = Number.isFinite(incomingAt)

  if (!current) {
    if (!incomingTimestampValid) {
      reportArticleStatsTelemetry('invalid_snapshot', { snapshotAt: incoming.snapshotAt })
    }
    return false
  }
  const regressedRevision = OWNER_REVISIONS.find(
    (revision) => incoming[revision] < current[revision],
  )
  if (regressedRevision) {
    reportArticleStatsTelemetry('mixed_snapshot', {
      currentSnapshotAt: current.snapshotAt,
      incomingSnapshotAt: incoming.snapshotAt,
      revision: regressedRevision,
      currentRevision: current[regressedRevision],
      incomingRevision: incoming[regressedRevision],
    })
    return true
  }

  const advancedRevision = OWNER_REVISIONS.some(
    (revision) => incoming[revision] > current[revision],
  )
  if (advancedRevision) {
    if (!incomingTimestampValid) {
      reportArticleStatsTelemetry('invalid_snapshot', { snapshotAt: incoming.snapshotAt })
    }
    return false
  }

  const currentAt = Date.parse(current.snapshotAt)
  if (!incomingTimestampValid) {
    reportArticleStatsTelemetry('invalid_snapshot', { snapshotAt: incoming.snapshotAt })
    return true
  }
  if (!Number.isFinite(currentAt)) return false
  return incomingAt < currentAt
}

/** Seeds one normalized ArticleStats entity without allowing an older snapshot to overwrite it. */
export const cacheArticleStats = (queryClient: QueryClient, stats: TArticleStats): void => {
  const key = articleKeys.stats(stats.community, stats.thread, stats.innerId)
  let accepted = false
  queryClient.setQueryData<TArticleStats>(key, (current) => {
    if (isOlderStats(current, stats)) return current
    accepted = true
    return stats
  })

  if (accepted && !Number.isFinite(Date.parse(stats.snapshotAt))) {
    void markStale(queryClient, key)
  }
}

/** Seeds all normalized ArticleStats entities returned by a public batch query. */
export const cacheArticleStatsEntities = (
  queryClient: QueryClient,
  stats: readonly TArticleStatsResponse[],
): void => {
  stats.forEach((item) => cacheArticleStats(queryClient, normalizeArticleStats(item)))
}

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
  const stats = (data.articleStats || []).map(normalizeArticleStats)
  stats.forEach((item) => cacheArticleStats(getQueryClient(), item))
  return stats
}

/** Fetches one public batch and normalizes every response into ArticleStats entities. */
export const articleStatsBatch = (
  community: string,
  thread: TArticleThread,
  innerIds: readonly (string | number)[],
) => {
  const normalizedIds = normalizeIds(innerIds)
  return {
    queryKey: articleKeys.statsBatch(community, thread, normalizedIds),
    queryFn: ({ signal }: { signal?: AbortSignal }) =>
      fetchArticleStats(community, thread, normalizedIds, signal),
    enabled: Boolean(community && thread && normalizedIds.length),
    staleTime: ARTICLE_STATS_SNAPSHOT_MAX_AGE_MS,
    meta: { hydration: 'public' },
  }
}

/** Reads one normalized ArticleStats entity, reusing a list batch when it seeded the cache. */
export const articleStats = (
  community: string,
  thread: TArticleThread,
  innerId: string | number,
) => {
  const normalizedId = String(innerId)
  return {
    queryKey: articleKeys.stats(community, thread, normalizedId),
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
    structuralSharing: (current: TArticleStats | undefined, incoming: TArticleStats) =>
      isOlderStats(current, incoming) ? current : incoming,
  }
}
