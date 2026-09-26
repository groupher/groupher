import { queryOptions, type QueryClient } from '@tanstack/react-query'

import { graphql } from '~/graphql/authoring'
import { browserGraphQLRequest } from '~/graphql/client'
import type { TCommentViewerStates } from '~/lib/commentViewerState'
import type { ArticleRefInput } from '~/lib/graphql/generated/graphql'
import { sessionState } from '~/schemas/pages/user'
import type { TCommentsState, TThread } from '~/spec'
import commentsSchema from '~/unit/Comments/schema'

import { viewerKeys } from './key'

export type TArticleViewerState = {
  articleKey: string
  viewerHasViewed?: boolean
  viewerHasUpvoted?: boolean
  viewerHasCollected?: boolean
  viewerEmotion?: string | null
}

export type TViewerArticleRef = ArticleRefInput

const articleViewerStates = graphql(`
  query ArticleViewerStates($refs: [ArticleRefInput!]!) {
    articleViewerStates(refs: $refs) {
      community
      thread
      innerId
      viewerHasViewed
      viewerHasUpvoted
    }
  }
`)

const articleInteractionStates = graphql(`
  query ArticleInteractionStates($refs: [ArticleRefInput!]!) {
    articleInteractionStates(refs: $refs) {
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
  query CommentViewerStates($article: ArticleRefInput!, $commentInnerIds: [ID!]!) {
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

const articleKey = (article: Pick<TViewerArticleRef, 'community' | 'thread' | 'innerId'>): string =>
  `${article.community}:${article.thread}:${String(article.innerId)}`

const normalizeArticleRefs = (articles: readonly TViewerArticleRef[]): TViewerArticleRef[] => {
  const refs = new Map<string, TViewerArticleRef>()
  for (const article of articles) {
    const normalized = {
      community: article.community.trim(),
      thread: article.thread,
      innerId: String(article.innerId),
    } satisfies TViewerArticleRef
    refs.set(articleKey(normalized), normalized)
  }
  return [...refs.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, article]) => article)
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
  viewerHasUpvoted?: boolean | null
}): TArticleViewerState => {
  const key = articleKey(article as TViewerArticleRef)
  return {
    articleKey: key,
    viewerHasViewed: article.viewerHasViewed ?? undefined,
    viewerHasUpvoted: article.viewerHasUpvoted ?? undefined,
  }
}

/** Applies a committed mutation result to every active Article viewer-state batch. */
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

  queryClient
    .getQueryCache()
    .findAll({ queryKey: viewerKeys.all })
    .filter((query) => viewerKeys.matchesArticleState(query, state.articleKey))
    .forEach((query) => {
      queryClient.setQueryData<Record<string, TArticleViewerState>>(query.queryKey, (current) => ({
        ...current,
        [state.articleKey]: {
          ...current?.[state.articleKey],
          ...state,
        },
      }))
    })
}

const fetchArticleViewerStates = async (
  articles: readonly TViewerArticleRef[],
  signal?: AbortSignal,
): Promise<Record<string, TArticleViewerState>> => {
  const normalized = normalizeArticleRefs(articles)
  const responses = await Promise.all(
    chunk(normalized, viewerBatchSize).map((batch) =>
      browserGraphQLRequest(articleViewerStates, { refs: batch }, { signal }),
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
  viewerEmotion?: string | null
}

const fetchArticleInteractionStates = async (
  articles: readonly TViewerArticleRef[],
  signal?: AbortSignal,
): Promise<Record<string, TArticleInteractionState>> => {
  const normalized = normalizeArticleRefs(articles)
  const responses = await Promise.all(
    chunk(normalized, viewerBatchSize).map((batch) =>
      browserGraphQLRequest(articleInteractionStates, { refs: batch }, { signal }),
    ),
  )
  return Object.fromEntries(
    responses.flatMap((data) =>
      data.articleInteractionStates.map((article) => {
        const key = articleKey(article as TViewerArticleRef)
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
  article: ArticleRefInput,
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

const articleStates = (accountRef: string, articles: readonly TViewerArticleRef[]) => {
  const normalized = normalizeArticleRefs(articles)
  return queryOptions({
    queryKey: viewerKeys.articleStates(accountRef, normalized.map(articleKey)),
    queryFn: ({ signal }) => (accountRef ? fetchArticleViewerStates(normalized, signal) : {}),
    enabled: !!accountRef && normalized.length > 0,
    staleTime: 30_000,
  })
}

const articleInteractionStateOptions = (
  accountRef: string,
  articles: readonly TViewerArticleRef[],
) => {
  const normalized = normalizeArticleRefs(articles)
  return queryOptions({
    queryKey: viewerKeys.articleInteractionStates(accountRef, normalized.map(articleKey)),
    queryFn: ({ signal }) => fetchArticleInteractionStates(normalized, signal),
    enabled: !!accountRef && normalized.length > 0,
    staleTime: 0,
    gcTime: 30_000,
  })
}

const commentStates = (
  accountRef: string,
  article: TViewerArticleRef,
  commentInnerIds: readonly string[],
) => {
  const normalizedArticle = {
    community: article.community.trim(),
    thread: article.thread,
    innerId: String(article.innerId),
  } satisfies TViewerArticleRef
  const articleKeyValue = articleKey(normalizedArticle)
  const normalizedIds = [...new Set(commentInnerIds.map(String))].sort()
  return queryOptions({
    queryKey: viewerKeys.commentStates(accountRef, articleKeyValue, normalizedIds),
    queryFn: ({ signal }) =>
      accountRef ? fetchCommentViewerStates(normalizedArticle, normalizedIds, signal) : {},
    enabled: !!accountRef && normalizedIds.length > 0,
    staleTime: 30_000,
  })
}

const session = () =>
  queryOptions({
    queryKey: viewerKeys.session(),
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
    queryKey: viewerKeys.commentSummary(accountRef, `${community}:${thread}:${String(innerId)}`),
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

export const viewerQueries = {
  session,
  articleStates,
  articleInteractionStates: articleInteractionStateOptions,
  commentStates,
  commentSummary,
}
