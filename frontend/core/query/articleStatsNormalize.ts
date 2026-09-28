/**
 * Maps GraphQL ArticleStats into the one cache shape used by browser, mutation, and SSR paths.
 *
 *   GraphQL ArticleStats DTO
 *     -> normalizeArticleStats
 *     -> TArticleStats
 *     -> detail/batch cache merge
 *
 * Centralizing this conversion prevents hydration and client fetches from storing subtly different
 * thread, ID, emotion, or timestamp representations under the same query key.
 */
import type { ResultOf } from '@graphql-typed-document-node/core'

import { articleStats as articleStatsDocument } from '~/schemas/pages/articleStats'
import type { TArticleStats, TArticleThread } from '~/spec'

export type TArticleStatsResponse = ResultOf<typeof articleStatsDocument>['articleStats'][number]

/** Converts a transport DTO into the strict ArticleStats value accepted by every cache writer. */
export const normalizeArticleStats = (stats: TArticleStatsResponse): TArticleStats => ({
  community: stats.community,
  thread: stats.thread as TArticleThread,
  innerId: String(stats.innerId),
  views: stats.views,
  viewsRevision: stats.viewsRevision,
  upvotesCount: stats.upvotesCount,
  commentsCount: stats.commentsCount,
  collectsCount: stats.collectsCount,
  commentsParticipantsCount: stats.commentsParticipantsCount,
  interactionRevision: stats.interactionRevision,
  commentsRevision: stats.commentsRevision,
  emotionCounts: stats.emotionCounts.map((emotion) => ({
    type: emotion.type,
    count: emotion.count,
  })),
  snapshotAt: stats.snapshotAt,
})
