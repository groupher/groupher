import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'

import { CONFIRMED_COMMENT_RECEIPT_MAX_REFS } from '~/constant/cache'
import { browserGraphQLRequest } from '~/graphql/client'
import { toPagiGraphQLInput, pagiConfigKey } from '~/lib/pagination/params'
import type { TComment, TEffectivePagiConfig, TPagiRequest, TThread } from '~/spec'
import commentsSchema from '~/unit/Comments/schema'

import { normalizeCommentPage, commentPagiRequest, type TCommentCollection } from './commentPage'
import { commentKeys } from './key'
import { preserveCommentProjection } from './revisionGuard'

export type TCommentReconcileResult = {
  article: {
    commentsRevision: number
    innerId: number
  }
  comments: Record<string, TComment | null>
}

/** The same public request contract is used by SSR, finite and infinite consumers. */
export const fetchCommentPage = async (
  collection: TCommentCollection,
  pagi: TPagiRequest,
  signal?: AbortSignal,
) => {
  const filter = { sort: collection.sort || 'ASC_INSERTED' } as const
  if (collection.rootInnerId) {
    const result = await browserGraphQLRequest(
      commentsSchema.commentReplyPage,
      {
        comment: { article: collection.article, innerId: collection.rootInnerId },
        filter,
        pagi: toPagiGraphQLInput(pagi),
      },
      { signal },
    )
    return normalizeCommentPage(result.commentReplyPage)
  }
  const result = await browserGraphQLRequest(
    commentsSchema.commentPage,
    {
      article: collection.article,
      mode: collection.mode,
      filter,
      pagi: toPagiGraphQLInput(pagi),
    },
    { signal },
  )
  return normalizeCommentPage(result.commentPage)
}

/** Builds a cache identity that separates collection, config revision, and position. */
export const commentPageKey = (
  collection: TCommentCollection,
  config: TEffectivePagiConfig,
  page?: number,
) =>
  commentKeys.page(
    collection.article.community,
    collection.article.thread,
    collection.article.innerId,
    {
      mode: collection.mode,
      rootInnerId: collection.rootInnerId,
      sort: collection.sort || 'ASC_INSERTED',
    },
    pagiConfigKey(config),
    config.api === 'offset'
      ? { size: config.defaultSize, page: page || 1 }
      : { first: config.defaultSize, infinite: true, after: collection.initialAfter },
  )

const page = (collection: TCommentCollection, config: TEffectivePagiConfig, page = 1) =>
  queryOptions({
    queryKey: commentPageKey(collection, config, page),
    structuralSharing: preserveCommentProjection,
    queryFn: ({ signal }) => fetchCommentPage(collection, commentPagiRequest(config, page), signal),
  })

const infinite = (collection: TCommentCollection, config: TEffectivePagiConfig) =>
  infiniteQueryOptions({
    queryKey: commentPageKey(collection, config),
    initialPageParam: collection.initialAfter,
    structuralSharing: preserveCommentProjection,
    queryFn: ({ pageParam, signal }) =>
      fetchCommentPage(collection, commentPagiRequest(config, 1, pageParam), signal),
    getNextPageParam: (last) =>
      last.pageInfo.api === 'cursor' && last.pageInfo.hasNextPage
        ? (last.pageInfo.endCursor ?? undefined)
        : undefined,
  })

const reconcile = (
  community: string,
  thread: TThread,
  innerId: string | number,
  commentRefs: readonly string[],
) => {
  const normalizedRefs = [...new Set(commentRefs.map(String))]
    .sort()
    .slice(0, CONFIRMED_COMMENT_RECEIPT_MAX_REFS)
  return queryOptions({
    queryKey: commentKeys.reconcile(community, thread, innerId, normalizedRefs),
    structuralSharing: preserveCommentProjection,
    queryFn: async ({ signal }) => {
      const response = await browserGraphQLRequest(
        commentsSchema.reconcileComments,
        {
          article: { community, thread, innerId: String(innerId) },
          commentInnerIds: normalizedRefs,
        },
        { signal },
      )
      const payload = response.commentReconcileStates
      return {
        article: payload.article,
        comments: Object.fromEntries(
          payload.entries.map((entry) => [String(entry.commentInnerId), entry.comment]),
        ),
      } as unknown as TCommentReconcileResult
    },
    enabled: normalizedRefs.length > 0,
    staleTime: 0,
    gcTime: 30_000,
  })
}

export const commentQueries = { page, infinite, reconcile }
