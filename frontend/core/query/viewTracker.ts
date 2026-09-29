/**
 * Sends the public Article view command and reconciles its committed owners.
 *
 *   visible Article
 *     -> trackArticleView GraphQL mutation
 *     -> ArticleStats cache + view-owned private cache
 *     -> same-session ViewAck
 *
 * The backend owns human/agent policy, dedupe, Gate admission, and atomic counting. The client only
 * retries transport failures once and never invents a local `views + 1` result.
 */
import type { ResultOf } from '@graphql-typed-document-node/core'
import type { QueryClient } from '@tanstack/react-query'

import { graphql } from '~/graphql/authoring'
import { browserGraphQLRequest } from '~/graphql/client'
import type { TArticleLoad } from '~/spec'

import { articlePathKey } from './articlePath'
import { articleStatsCache, normalizeArticleStats } from './articleStats'
import { getQueryClient, isRetryableTransportError } from './queryClient'
import { writeArticleViewAck } from './viewAck'
import { cacheArticleViewedState } from './viewer'

/** Public GraphQL command returning the committed stats and ViewTracker-owned private state. */
export const trackArticleViewMutation = graphql(`
  mutation TrackArticleView($article: ArticlePathInput!) {
    trackArticleView(article: $article) {
      tracked
      articleStats {
        ...ArticleStatsFields
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

/** Applies committed public/private view owners and records an Ack only when counting was accepted. */
export const applyViewResult = (
  queryClient: QueryClient,
  result: TTrackArticleViewResult,
): void => {
  articleStatsCache.apply(queryClient, normalizeArticleStats(result.articleStats))
  cacheArticleViewedState(queryClient, result.viewerState)
  if (result.tracked) writeArticleViewAck(articlePathKey(result.articleStats))
}

/** Sends one view command with a single transport retry, then applies the committed server result. */
export const trackArticleView = async ({ community, thread, innerId }: TArticleLoad) => {
  if (typeof window === 'undefined') return null

  const article = { community, thread, innerId: String(innerId) }
  const request = () => browserGraphQLRequest(trackArticleViewMutation, { article })
  // A transport retry is safe because the server dedupe window owns idempotency.
  let data
  try {
    data = await request()
  } catch (error) {
    if (!isRetryableTransportError(error)) throw error
    data = await request()
  }
  const result = data.trackArticleView
  applyViewResult(getQueryClient(), result)

  return result
}
