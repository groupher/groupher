import { queryOptions } from '@tanstack/react-query'

import { CONFIRMED_COMMENT_RECEIPT_MAX_REFS } from '~/constant/cache'
import { browserGraphQLRequest } from '~/graphql/client'
import type { TComment, TPagedComments, TThread } from '~/spec'
import commentsSchema from '~/unit/Comments/schema'

import { commentKeys } from './key'
import { preserveCommentProjection } from './revisionGuard'

export type TCommentReconcileResult = {
  article: {
    commentsRevision: number
    innerId: number
  }
  comments: Record<string, TComment | null>
}

const list = (
  community: string,
  thread: TThread,
  innerId: string | number,
  page = 1,
  mode = 'REPLIES',
) =>
  queryOptions({
    queryKey: commentKeys.list(community, thread, innerId, page, mode),
    structuralSharing: preserveCommentProjection,
    queryFn: async () => {
      const data = await browserGraphQLRequest(commentsSchema.publicPagedComments, {
        article: { community, thread, innerId: String(innerId) },
        mode: mode as 'REPLIES' | 'TIMELINE',
        filter: { page, size: 30 },
      })
      return data.pagedComments as unknown as TPagedComments
    },
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
    queryFn: async () => {
      const response = await browserGraphQLRequest(commentsSchema.reconcileComments, {
        article: { community, thread, innerId: String(innerId) },
        commentInnerIds: normalizedRefs,
      })
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

export const commentQueries = { list, reconcile }
