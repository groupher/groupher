import { graphql } from '~/graphql/authoring'
import { browserGraphQLRequest } from '~/graphql/client'
import type { TArticleLoad } from '~/spec'

import { cacheArticleStatsEntities } from './articleStats'
import { getQueryClient } from './queryClient'
import { getArticleViewAttemptId } from './viewAttempt'
import { cacheArticleViewedState } from './viewer'
import { writeArticleViewReceipt } from './viewReceipt'

export const trackArticleViewMutation = graphql(`
  mutation TrackArticleView($article: ArticlePathInput!, $eventId: ID!) {
    trackArticleView(article: $article, eventId: $eventId) {
      counted
      decisionReason
      eventId
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
        reactionCounts {
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

/** Tracks one visible logical read; callers reuse the same event id when retrying. */
export const trackArticleView = async ({ community, thread, innerId }: TArticleLoad) => {
  const eventId = getArticleViewAttemptId()
  if (!eventId) return null

  const article = { community, thread, innerId: String(innerId) }
  const request = () => browserGraphQLRequest(trackArticleViewMutation, { article, eventId })
  // One transport retry reuses the same event id; the server owns idempotency.
  const data = await request().catch(request)
  const result = data.trackArticleView
  const queryClient = getQueryClient()

  cacheArticleStatsEntities(queryClient, [result.articleStats])
  cacheArticleViewedState(queryClient, result.viewerState)

  if (result.decisionReason !== 'EXCLUDED_BY_POLICY') {
    writeArticleViewReceipt(`${community}:${thread}:${innerId}`, String(result.eventId))
  }

  return result
}
