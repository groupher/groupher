import { graphql } from '~/graphql/authoring'
import { browserGraphQLRequest } from '~/graphql/client'
import type { TArticleLoad } from '~/spec'

import { articleKeys } from './key'
import { getQueryClient } from './queryClient'
import { getArticleViewEventId } from './viewEvent'
import { writeArticleViewReceipt } from './viewReceipt'

export const trackArticleViewMutation = graphql(`
  mutation TrackArticleView($article: ArticlePathInput!, $eventId: ID!) {
    trackArticleView(article: $article, eventId: $eventId) {
      accepted
      eventId
    }
  }
`)

/** Tracks one visible logical read; callers reuse the same event id when retrying. */
export const trackArticleView = async ({ community, thread, innerId }: TArticleLoad) => {
  const eventId = getArticleViewEventId()
  if (!eventId) return null

  const article = { community, thread, innerId: String(innerId) }
  const request = () => browserGraphQLRequest(trackArticleViewMutation, { article, eventId })
  // One transport retry reuses the same event id; the server owns idempotency.
  const data = await request().catch(request)
  const receipt = data.trackArticleView

  if (receipt.accepted) {
    writeArticleViewReceipt(`${community}:${thread}:${innerId}`, String(receipt.eventId))
    const queryClient = getQueryClient()
    const statsKey = articleKeys.articleStats(community, thread, innerId)
    void queryClient.invalidateQueries({ queryKey: statsKey })
    void queryClient.invalidateQueries({
      predicate: ({ queryKey }) =>
        queryKey.length >= 4 &&
        queryKey[0] === 'article' &&
        queryKey[1] === 'article-stats' &&
        queryKey[2] === community &&
        queryKey[3] === thread &&
        Array.isArray(queryKey[4]),
    })
    // Projection is intentionally asynchronous. Re-mark the same summary stale
    // after the usual queue latency instead of guessing a local +1.
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: statsKey })
        void queryClient.invalidateQueries({
          predicate: ({ queryKey }) =>
            queryKey.length >= 4 &&
            queryKey[0] === 'article' &&
            queryKey[1] === 'article-stats' &&
            queryKey[2] === community &&
            queryKey[3] === thread &&
            Array.isArray(queryKey[4]),
        })
      }, 1000)
    }
  }

  return receipt
}
