import { browserGraphQLRequest } from '~/graphql/client'
import commentsSchema from '~/unit/Comments/schema'

import { viewerQueryKeys } from '../../key'
import type { TOptimisticPlan, TOperationContext, TQueryTarget } from '../optimistic/types'
import {
  patchCommentViewerChanges,
  patchCommentViewerState,
  type TCommentMutationResult,
  type TCommentTarget,
} from './cache'

export const reportCommentOperation = {
  name: 'comment.report',
  entityKey: (target: TCommentTarget) => `${target.articleKey}:${target.commentInnerId}`,
  queueKey: (target: TCommentTarget) =>
    `comment:${target.articleKey}:${target.commentInnerId}:moderation`,
  queriesToCancel: (context: TOperationContext, target: TCommentTarget): readonly TQueryTarget[] =>
    context.accountRef
      ? context.queryClient
          .getQueryCache()
          .findAll({
            queryKey: viewerQueryKeys.commentStatePrefix(context.accountRef, target.articleKey),
          })
          .map(({ queryKey }) => ({ queryKey, exact: true }))
      : [],
  apply: (context: TOperationContext, target: TCommentTarget): TOptimisticPlan => {
    const changes = patchCommentViewerChanges(
      context.queryClient,
      target,
      'viewerHasReported',
      true,
      context,
    )
    return { changes, refetchOnFailure: [] }
  },
  execute: async (
    _context: TOperationContext,
    target: TCommentTarget,
  ): Promise<TCommentMutationResult> => {
    const result = await browserGraphQLRequest(commentsSchema.reportComment, {
      attr: null,
      comment: target.commentPath,
      reason: 'OTHER',
    })
    if (!result.reportComment) throw new Error('Report comment response is empty')
    return result.reportComment as unknown as TCommentMutationResult
  },
  reconcile: (
    context: TOperationContext,
    target: TCommentTarget,
    _input: undefined,
    result: TCommentMutationResult,
  ): void => {
    if (!context.accountRef) return
    patchCommentViewerState(
      context.queryClient,
      context.accountRef,
      target.articleKey,
      target.commentInnerId,
      (state) => ({
        ...state,
        viewerHasReported:
          typeof result.viewerHasReported === 'boolean' ? result.viewerHasReported : true,
      }),
    )
  },
}
