/**
 * Owns viewer-scoped query options and precise cache updates for private read state.
 *
 *   Article/Comment paths + accountRef
 *     -> private GraphQL batch query
 *     -> path-keyed viewer maps
 *     -> mutation patch / hook composition
 *
 * ViewTracker-owned `viewerHasViewed` and Interactions-owned relation fields remain separate query
 * owners. None of these values enter public SSR hydration or Article content responses.
 */
import { queryOptions, type QueryClient } from '@tanstack/react-query'

import { graphql } from '~/graphql/authoring'
import { browserGraphQLRequest } from '~/graphql/client'
import type { TCommentViewerStates } from '~/lib/commentViewerState'
import type { ArticlePathInput } from '~/lib/graphql/generated/graphql'
import { sessionState } from '~/schemas/pages/user'
import type { TArticleViewerState, TCommentsState, TThread } from '~/spec'
import commentsSchema from '~/unit/Comments/schema'

import { articlePathKey, type TArticlePath } from './articlePath'
import { markStale } from './invalidation'
import { viewerQueryKeys } from './key'

const articleViewerStates = graphql(`
  query ArticleViewerStates($paths: [ArticlePathInput!]!) {
    articleViewerStates(paths: $paths) {
      community
      thread
      innerId
      viewerHasViewed
    }
  }
`)

const articleInteractionStates = graphql(`
  query ArticleInteractionStates($paths: [ArticlePathInput!]!) {
    articleInteractionStates(paths: $paths) {
      community
      thread
      innerId
      interactionRevision
      viewerHasUpvoted
      viewerHasCollected
      viewerEmotion
    }
  }
`)

const commentViewerStates = graphql(`
  query CommentViewerStates($article: ArticlePathInput!, $commentInnerIds: [ID!]!) {
    commentViewerStates(article: $article, commentInnerIds: $commentInnerIds) {
      innerId
      viewerHasUpvoted
      viewerHasReported
      emotions {
        type
        viewerHasReacted
      }
    }
  }
`)

const viewerBatchSize = 100

const normalizeArticlePaths = (articles: readonly TArticlePath[]): TArticlePath[] => {
  const paths = new Map<string, TArticlePath>()
  for (const article of articles) {
    const normalized = {
      community: article.community.trim(),
      thread: article.thread,
      innerId: String(article.innerId),
    } satisfies TArticlePath
    paths.set(articlePathKey(normalized), normalized)
  }
  return [...paths.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, article]) => article)
}

const articleStateQueryContains = (queryKey: readonly unknown[], articleKey: string): boolean => {
  const [domain, _accountRef, target, articlePathKeys] = queryKey
  return (
    domain === viewerQueryKeys.all[0] &&
    target === 'article-state' &&
    Array.isArray(articlePathKeys) &&
    articlePathKeys.includes(articleKey)
  )
}

const articleInteractionStateQueryContains = (
  queryKey: readonly unknown[],
  articleKey: string,
): boolean => {
  const [domain, _accountRef, target, articlePathKeys] = queryKey
  return (
    domain === viewerQueryKeys.all[0] &&
    target === 'article-interaction-state' &&
    Array.isArray(articlePathKeys) &&
    articlePathKeys.includes(articleKey)
  )
}

/** Finds loaded private interaction batches for one account that contain the target Article path. */
export const articleInteractionStateQueries = (
  queryClient: QueryClient,
  accountRef: string,
  article: TArticlePath,
) => {
  const articleKey = articlePathKey(article)
  return queryClient
    .getQueryCache()
    .findAll({ queryKey: viewerQueryKeys.articleInteractionStatePrefix(accountRef) })
    .filter((query) => articleInteractionStateQueryContains(query.queryKey, articleKey))
}

const chunk = <T>(values: readonly T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }
  return chunks
}

const toViewerState = (article: {
  community: string
  thread: string
  innerId: string | number
  viewerHasViewed?: boolean | null
}): TArticleViewerState => {
  const key = articlePathKey(article as TArticlePath)
  return {
    articleKey: key,
    viewerHasViewed: article.viewerHasViewed ?? undefined,
  }
}

/** Patches a committed ViewTracker result into every existing viewer batch containing its path. */
export const cacheArticleViewedState = (
  queryClient: QueryClient,
  article: {
    community: string
    thread: string
    innerId: string | number
    viewerHasViewed?: boolean | null
  },
): void => {
  const state = toViewerState(article)

  const queries = queryClient
    .getQueryCache()
    .findAll({ queryKey: viewerQueryKeys.all })
    .filter((query) => articleStateQueryContains(query.queryKey, state.articleKey))

  for (const query of queries) {
    queryClient.setQueryData<Record<string, TArticleViewerState>>(query.queryKey, (current) => ({
      ...current,
      [state.articleKey]: {
        ...current?.[state.articleKey],
        ...state,
      },
    }))
  }
}

const fetchArticleViewerStates = async (
  articles: readonly TArticlePath[],
  signal?: AbortSignal,
): Promise<Record<string, TArticleViewerState>> => {
  const normalized = normalizeArticlePaths(articles)
  const responses = await Promise.all(
    chunk(normalized, viewerBatchSize).map((batch) =>
      browserGraphQLRequest(articleViewerStates, { paths: batch }, { signal }),
    ),
  )
  return Object.fromEntries(
    responses.flatMap((data) =>
      data.articleViewerStates.map((article) => {
        const state = toViewerState(article)
        return [state.articleKey, state] as const
      }),
    ),
  )
}

export type TArticleInteractionState = {
  articleKey: string
  community: string
  thread: string
  innerId: string
  interactionRevision: number
  viewerHasUpvoted: boolean
  viewerHasCollected: boolean
  viewerEmotion?: TArticleViewerState['viewerEmotion']
}

/**
 * Patches committed private Interaction state without allowing revision regression.
 *
 * Equal-revision field disagreement retains the current value and marks the query stale because it
 * violates the owner revision contract; missing batches are never created as mutation side effects.
 */
export const cacheArticleInteractionState = (
  queryClient: QueryClient,
  accountRef: string,
  state: TArticleInteractionState,
): void => {
  const queries = queryClient
    .getQueryCache()
    .findAll({ queryKey: viewerQueryKeys.articleInteractionStatePrefix(accountRef) })
    .filter((query) => articleInteractionStateQueryContains(query.queryKey, state.articleKey))

  for (const query of queries) {
    const updatedAt = query.state.dataUpdatedAt
    let conflict = false
    queryClient.setQueryData<Record<string, TArticleInteractionState>>(
      query.queryKey,
      (current) => {
        if (!current?.[state.articleKey]) return current
        const existing = current[state.articleKey]
        if (existing.interactionRevision > state.interactionRevision) return current
        if (existing.interactionRevision === state.interactionRevision) {
          const same =
            existing.viewerHasUpvoted === state.viewerHasUpvoted &&
            existing.viewerHasCollected === state.viewerHasCollected &&
            existing.viewerEmotion === state.viewerEmotion
          conflict = !same
          return current
        }
        return { ...current, [state.articleKey]: state }
      },
      { updatedAt },
    )
    if (conflict) {
      void markStale(queryClient, query.queryKey)
    }
  }
}

const fetchArticleInteractionStates = async (
  articles: readonly TArticlePath[],
  signal?: AbortSignal,
): Promise<Record<string, TArticleInteractionState>> => {
  const normalized = normalizeArticlePaths(articles)
  const responses = await Promise.all(
    chunk(normalized, viewerBatchSize).map((batch) =>
      browserGraphQLRequest(articleInteractionStates, { paths: batch }, { signal }),
    ),
  )
  return Object.fromEntries(
    responses.flatMap((data) =>
      data.articleInteractionStates.map((article) => {
        const key = articlePathKey(article as TArticlePath)
        return [
          key,
          {
            ...article,
            articleKey: key,
            innerId: String(article.innerId),
            interactionRevision: article.interactionRevision,
            viewerHasUpvoted: article.viewerHasUpvoted,
            viewerHasCollected: article.viewerHasCollected,
            viewerEmotion: article.viewerEmotion,
          },
        ] as const
      }),
    ),
  )
}

const fetchCommentViewerStates = async (
  article: ArticlePathInput,
  commentInnerIds: readonly string[],
  signal?: AbortSignal,
): Promise<TCommentViewerStates> => {
  const normalizedIds = [...new Set(commentInnerIds.map(String))].sort()
  const responses = await Promise.all(
    chunk(normalizedIds, viewerBatchSize).map((ids) =>
      browserGraphQLRequest(
        commentViewerStates,
        {
          article,
          commentInnerIds: ids,
        },
        { signal },
      ),
    ),
  )
  const states: TCommentViewerStates = {}
  for (const data of responses) {
    for (const comment of data.commentViewerStates) {
      const emotionFlags: TCommentViewerStates[string]['emotionFlags'] = {}
      for (const emotion of comment.emotions) {
        if (emotion.type !== 'UPVOTE') emotionFlags[emotion.type] = emotion.viewerHasReacted
      }
      states[String(comment.innerId)] = {
        emotionFlags,
        viewerHasUpvoted: comment.viewerHasUpvoted ?? undefined,
        viewerHasReported: comment.viewerHasReported ?? undefined,
      }
    }
  }
  return states
}

const articleStates = (accountRef: string, articles: readonly TArticlePath[]) => {
  const normalized = normalizeArticlePaths(articles)
  return queryOptions({
    queryKey: viewerQueryKeys.articleStates(accountRef, normalized.map(articlePathKey)),
    queryFn: ({ signal }) => (accountRef ? fetchArticleViewerStates(normalized, signal) : {}),
    enabled: !!accountRef && normalized.length > 0,
    staleTime: 30_000,
  })
}

const articleInteractionStateOptions = (accountRef: string, articles: readonly TArticlePath[]) => {
  const normalized = normalizeArticlePaths(articles)
  return queryOptions({
    queryKey: viewerQueryKeys.articleInteractionStates(accountRef, normalized.map(articlePathKey)),
    queryFn: ({ signal }) => fetchArticleInteractionStates(normalized, signal),
    enabled: !!accountRef && normalized.length > 0,
    staleTime: 0,
    gcTime: 30_000,
  })
}

const commentStates = (
  accountRef: string,
  article: TArticlePath,
  commentInnerIds: readonly string[],
) => {
  const normalizedArticle = {
    community: article.community.trim(),
    thread: article.thread,
    innerId: String(article.innerId),
  } satisfies TArticlePath
  const articleKeyValue = articlePathKey(normalizedArticle)
  const normalizedIds = [...new Set(commentInnerIds.map(String))].sort()
  return queryOptions({
    queryKey: viewerQueryKeys.commentStates(accountRef, articleKeyValue, normalizedIds),
    queryFn: ({ signal }) =>
      accountRef ? fetchCommentViewerStates(normalizedArticle, normalizedIds, signal) : {},
    enabled: !!accountRef && normalizedIds.length > 0,
    staleTime: 30_000,
  })
}

const session = () =>
  queryOptions({
    queryKey: viewerQueryKeys.session(),
    queryFn: ({ signal }) => browserGraphQLRequest(sessionState, {}, { signal }),
    staleTime: 30_000,
  })

const commentSummary = (
  accountRef: string,
  community: string,
  thread: TThread,
  innerId: string | number,
) =>
  queryOptions({
    queryKey: viewerQueryKeys.commentSummary(
      accountRef,
      articlePathKey({ community, thread, innerId }),
    ),
    queryFn: async ({ signal }) => {
      const data = await browserGraphQLRequest(
        commentsSchema.commentsState,
        { article: { community, thread, innerId: String(innerId) } },
        { signal },
      )
      return data.commentsState as TCommentsState
    },
    enabled: !!community && !!innerId,
    staleTime: 30_000,
  })

/** Query-option constructors for session, Article private owners, and Comment viewer state. */
export const viewerQueries = {
  session,
  articleStates,
  articleInteractionStates: articleInteractionStateOptions,
  commentStates,
  commentSummary,
}
