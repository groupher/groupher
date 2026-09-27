import type { ResultOf } from '@graphql-typed-document-node/core'
import type { QueryClient } from '@tanstack/react-query'

import { graphql } from '~/graphql/authoring'
import { browserGraphQLRequest } from '~/graphql/client'
import type { TArticleLoad } from '~/spec'

import { articleRefKey } from './articleRef'
import { cacheArticleStatsEntities } from './articleStats'
import { getQueryClient } from './queryClient'
import { writeArticleViewAck } from './viewAck'
import { cacheArticleViewedState } from './viewer'

export const trackArticleViewMutation = graphql(`
  mutation TrackArticleView($article: ArticlePathInput!) {
    trackArticleView(article: $article) {
      tracked
      articleStats {
        community
        thread
        innerId
        views
        viewsRevision
        upvotesCount
        commentsCount
        collectsCount
        commentsParticipantsCount
        interactionRevision
        commentsRevision
        emotionCounts {
          type
          count
        }
        snapshotAt
      }
      viewerState {
        community
        thread
        innerId
        viewerHasViewed
      }
    }
  }
`)

type TTrackArticleViewResult = ResultOf<typeof trackArticleViewMutation>['trackArticleView']

/** Applies the committed response to the shared stats/viewer owners and local acknowledgement. */
export const applyViewResult = (
  queryClient: QueryClient,
  result: TTrackArticleViewResult,
): void => {
  cacheArticleStatsEntities(queryClient, [result.articleStats])
  cacheArticleViewedState(queryClient, result.viewerState)
  if (result.tracked) writeArticleViewAck(articleRefKey(result.articleStats))
}

/** Tracks one visible read; the server owns dedupe and returns committed state. */
export const trackArticleView = async ({ community, thread, innerId }: TArticleLoad) => {
  if (typeof window === 'undefined') return null

  const article = { community, thread, innerId: String(innerId) }
  const request = () => browserGraphQLRequest(trackArticleViewMutation, { article })
  // A transport retry is safe because the server dedupe window owns idempotency.
  const data = await request().catch(request)
  const result = data.trackArticleView
  applyViewResult(getQueryClient(), result)

  return result
}
