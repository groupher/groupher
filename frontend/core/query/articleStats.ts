import type { ResultOf } from '@graphql-typed-document-node/core'
import { ARTICLE_STATS_CACHE_POLICY } from '@groupher/contracts/article-stats'
import type { QueryClient } from '@tanstack/react-query'

import { browserGraphQLRequest } from '~/graphql/client'
import { articleStats as articleStatsDocument } from '~/schemas/pages/articleStats'
import type { TArticleThread, TThread } from '~/spec'

import { articleKeys } from './key'
import { getQueryClient } from './queryClient'

export type TArticleStatsResponse = ResultOf<typeof articleStatsDocument>['articleStats'][number]
export type TArticleStats = {
  community: string
  thread: TThread
  innerId: string
  views: number
  viewsRevision: number
  upvotesCount: number
  commentsCount: number
  snapshotAt: string
}

const normalizeArticleStats = (stats: TArticleStatsResponse): TArticleStats => ({
  community: String(stats.community),
  thread: stats.thread as TThread,
  innerId: String(stats.innerId),
  views: Number(stats.views),
  viewsRevision: Number(stats.viewsRevision),
  upvotesCount: Number(stats.upvotesCount),
  commentsCount: Number(stats.commentsCount),
  snapshotAt: String(stats.snapshotAt),
})

export const ARTICLE_STATS_SNAPSHOT_MAX_AGE_MS =
  ARTICLE_STATS_CACHE_POLICY.snapshotMaxAgeSeconds * 1_000

type TArticleStatsTelemetryEvent = 'clock_skew' | 'invalid_snapshot' | 'mixed_snapshot'

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
  if (!current) return false
  const currentAt = Date.parse(current.snapshotAt)
  const incomingAt = Date.parse(incoming.snapshotAt)
  if (!Number.isFinite(incomingAt)) {
    reportArticleStatsTelemetry('invalid_snapshot', { snapshotAt: incoming.snapshotAt })
    return true
  }
  if (!Number.isFinite(currentAt)) return false
  if (incomingAt > currentAt && incoming.viewsRevision < current.viewsRevision) {
    reportArticleStatsTelemetry('mixed_snapshot', {
      currentSnapshotAt: current.snapshotAt,
      incomingSnapshotAt: incoming.snapshotAt,
      currentViewsRevision: current.viewsRevision,
      incomingViewsRevision: incoming.viewsRevision,
    })
    return true
  }
  return (
    incomingAt < currentAt ||
    (incomingAt === currentAt && incoming.viewsRevision < current.viewsRevision)
  )
}

/** Seeds one normalized ArticleStats entity without allowing an older snapshot to overwrite it. */
export const cacheArticleStats = (queryClient: QueryClient, stats: TArticleStats): void => {
  const key = articleKeys.articleStats(stats.community, stats.thread, stats.innerId)
  queryClient.setQueryData<TArticleStats>(key, (current) =>
    isOlderStats(current, stats) ? current : stats,
  )
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
  cacheArticleStatsEntities(getQueryClient(), stats)
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
    queryKey: articleKeys.articleStatsBatch(community, thread, normalizedIds),
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
    queryKey: articleKeys.articleStats(community, thread, normalizedId),
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
