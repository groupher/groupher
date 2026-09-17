import { graphql } from '~/graphql/authoring'
import { browserGraphQLRequest } from '~/graphql/client'
import type { TArticleLoad, TArticleThread } from '~/spec'

import { articleKeys } from './key'
import { getQueryClient } from './queryClient'
import { getArticleViewEventId } from './viewEvent'
import { writeArticleViewReceipt } from './viewReceipt'

const SUMMARY_FRESHNESS_MS = 15_000

type TArticleViewSummary = {
  community: string
  thread: TArticleThread
  innerId: string
  views: number
  revision: number
}

const cacheSummary = (summary: TArticleViewSummary) => {
  const queryClient = getQueryClient()
  const key = articleKeys.viewSummary(summary.community, summary.thread, summary.innerId)

  queryClient.setQueryData<TArticleViewSummary>(key, (previous) =>
    previous && previous.revision > summary.revision ? previous : summary,
  )
}

export const trackArticleViewMutation = graphql(`
  mutation TrackArticleView($article: ArticlePathInput!, $eventId: ID!) {
    trackArticleView(article: $article, eventId: $eventId) {
      accepted
      eventId
    }
  }
`)

export const articleViewSummariesQuery = graphql(`
  query ArticleViewSummaries($community: String!, $thread: Thread!, $innerIds: [ID!]!) {
    articleViewSummaries(community: $community, thread: $thread, innerIds: $innerIds) {
      community
      thread
      innerId
      views
      revision
    }
  }
`)

/** Fetches a public batch and normalizes every returned Summary into its entity cache. */
export const articleViewSummaries = (
  community: string,
  thread: TArticleThread,
  innerIds: readonly (string | number)[],
) => {
  const normalizedIds = [...new Set(innerIds.map(String))].sort()

  return {
    queryKey: articleKeys.viewSummaries(community, thread, normalizedIds),
    queryFn: async () => {
      const data = await browserGraphQLRequest(articleViewSummariesQuery, {
        community,
        thread,
        innerIds: normalizedIds,
      })
      const summaries = data.articleViewSummaries as TArticleViewSummary[]
      summaries.forEach(cacheSummary)
      return summaries
    },
    enabled: Boolean(community && thread && normalizedIds.length),
    staleTime: SUMMARY_FRESHNESS_MS,
  }
}

/** Reads one normalized Summary entity, reusing a list batch when it already seeded the cache. */
export const articleViewSummary = (
  community: string,
  thread: TArticleThread,
  innerId: string | number,
) => {
  const normalizedId = String(innerId)

  return {
    queryKey: articleKeys.viewSummary(community, thread, normalizedId),
    queryFn: async () => {
      const data = await browserGraphQLRequest(articleViewSummariesQuery, {
        community,
        thread,
        innerIds: [normalizedId],
      })
      const summary = (data.articleViewSummaries[0] || {
        community,
        thread,
        innerId: normalizedId,
        views: 0,
        revision: 0,
      }) as TArticleViewSummary
      cacheSummary(summary)
      return summary
    },
    enabled: Boolean(community && thread && normalizedId),
    staleTime: SUMMARY_FRESHNESS_MS,
    structuralSharing: (previous: TArticleViewSummary | undefined, next: TArticleViewSummary) =>
      previous && previous.revision > next.revision ? previous : next,
  }
}

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
    const summaryKey = articleKeys.viewSummary(community, thread, innerId)
    void queryClient.invalidateQueries({ queryKey: summaryKey })
    void queryClient.invalidateQueries({
      predicate: ({ queryKey }) =>
        queryKey.length >= 4 &&
        queryKey[0] === 'article' &&
        queryKey[1] === 'view-summary' &&
        queryKey[2] === community &&
        queryKey[3] === thread &&
        Array.isArray(queryKey[4]),
    })
    // Projection is intentionally asynchronous. Re-mark the same summary stale
    // after the usual queue latency instead of guessing a local +1.
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: summaryKey })
        void queryClient.invalidateQueries({
          predicate: ({ queryKey }) =>
            queryKey.length >= 4 &&
            queryKey[0] === 'article' &&
            queryKey[1] === 'view-summary' &&
            queryKey[2] === community &&
            queryKey[3] === thread &&
            Array.isArray(queryKey[4]),
        })
      }, 1000)
    }
  }

  return receipt
}
