import { browserGraphQLRequest } from '~/graphql/client'
import { stripCommentViewerState } from '~/lib/commentViewerState'
import type { TComment, TThread } from '~/spec'
import commentsSchema from '~/unit/Comments/schema'

import { articleQueryTargets, patchArticleChanges, patchArticleEverywhere } from '../article/cache'
import { writeCommentFeedReceipt } from '../commentReceipt'
import type { TOptimisticPlan, TOperationContext, TQueryTarget } from '../optimistic/types'
import {
  authorityQueries,
  commentOperationQueueKey,
  commentQueryTargets,
  insertPendingCommentChanges,
  insertPendingReplyChanges,
  makePendingComment,
  patchCommentChanges,
  patchCommentEverywhere,
  reconcileCreatedComment,
  type TCommentLifecycleTarget,
  type TCommentMutationResult,
  type TCommentTarget,
} from './cache'

type TCreatedCommentResult = {
  comment: TComment
  article: { commentsCount: number; commentsRevision?: number }
}

const lifecycleQueryTargets = (
  context: TOperationContext,
  target: TCommentLifecycleTarget,
): readonly TQueryTarget[] => [
  ...commentQueryTargets(context.queryClient, target.scope),
  ...articleQueryTargets(context.queryClient),
]

const makeCommentCreatePlan = (
  context: TOperationContext,
  target: TCommentLifecycleTarget,
  body: string,
  reply: boolean,
): TOptimisticPlan => {
  const pending = makePendingComment(context, target, body)
  const changes = reply
    ? insertPendingReplyChanges(context.queryClient, { ...target, pending }, context)
    : insertPendingCommentChanges(context.queryClient, { ...target, pending }, context)
  changes.push(
    ...patchArticleChanges(
      context.queryClient,
      target.articlePath,
      'commentsCount',
      (article) => ({ ...article, commentsCount: (article.commentsCount || 0) + 1 }),
      context,
    ),
  )
  return { changes, refetchOnFailure: authorityQueries(changes) }
}

const reconcileCreated = (
  context: TOperationContext,
  target: TCommentLifecycleTarget,
  _body: string,
  result: TCreatedCommentResult,
): void => {
  reconcileCreatedComment(
    context.queryClient,
    target.scope,
    `pending:${context.commandId}`,
    stripCommentViewerState(result.comment),
    target.articlePath,
    result.article.commentsCount,
    result.article.commentsRevision,
  )
  if (!context.accountRef) return
  writeCommentFeedReceipt({
    type: 'create',
    commandId: context.commandId,
    accountRef: context.accountRef,
    articleKey: target.articleKey,
    comment: stripCommentViewerState(result.comment),
    commentRef: String(result.comment.innerId),
    parentId: target.parentId,
    publicProjection: {
      commentsCount: result.article.commentsCount,
      commentsRevision: result.article.commentsRevision,
    },
  })
}

export const createCommentOperation = {
  name: 'comment.create',
  entityKey: (target: TCommentLifecycleTarget) => target.articleKey,
  queueKey: (target: TCommentLifecycleTarget) => commentOperationQueueKey(target),
  queriesToCancel: lifecycleQueryTargets,
  apply: (context: TOperationContext, target: TCommentLifecycleTarget, _body: string) =>
    makeCommentCreatePlan(context, target, _body, false),
  execute: async (
    _context: TOperationContext,
    target: TCommentLifecycleTarget,
    body: string,
  ): Promise<TCreatedCommentResult> => {
    const result = await browserGraphQLRequest(commentsSchema.createComment, {
      article: target.articlePath,
      body,
      commandId: _context.commandId,
    })
    if (!result.createComment) throw new Error('Create comment response is empty')
    return result.createComment as unknown as TCreatedCommentResult
  },
  reconcile: reconcileCreated,
}

export const replyCommentOperation = {
  name: 'comment.reply',
  entityKey: (target: TCommentLifecycleTarget) => `${target.articleKey}:${target.parentId}`,
  queueKey: (target: TCommentLifecycleTarget) => commentOperationQueueKey(target),
  queriesToCancel: lifecycleQueryTargets,
  apply: (context: TOperationContext, target: TCommentLifecycleTarget, _body: string) =>
    makeCommentCreatePlan(context, target, _body, true),
  execute: async (
    _context: TOperationContext,
    target: TCommentLifecycleTarget,
    body: string,
  ): Promise<TCreatedCommentResult> => {
    if (!target.parentId) throw new Error('Reply parent is missing')
    const result = await browserGraphQLRequest(commentsSchema.replyComment, {
      comment: { article: target.articlePath, innerId: target.parentId },
      body,
      commandId: _context.commandId,
    })
    if (!result.replyComment) throw new Error('Reply comment response is empty')
    return result.replyComment as unknown as TCreatedCommentResult
  },
  reconcile: reconcileCreated,
}

type TUpdatedCommentResult = TComment & {
  article?: {
    innerId?: string | number
    thread?: TThread
    commentsCount?: number | null
    commentsRevision?: number | null
  }
}

/** Updates a comment body through the same Action lifecycle as create/delete. */
export const updateCommentOperation = {
  name: 'comment.update',
  entityKey: (target: TCommentTarget) => `${target.articleKey}:${target.commentInnerId}`,
  queueKey: (target: TCommentTarget) => commentOperationQueueKey(target),
  queriesToCancel: (context: TOperationContext, target: TCommentTarget) => [
    ...commentQueryTargets(context.queryClient, target.scope),
    ...articleQueryTargets(context.queryClient),
  ],
  apply: (context: TOperationContext, target: TCommentTarget, body: string): TOptimisticPlan => {
    const changes = patchCommentChanges(
      context.queryClient,
      target,
      'bodyHtml',
      (comment) => ({ ...comment, bodyHtml: body }),
      context,
    )
    return { changes, refetchOnFailure: authorityQueries(changes) }
  },
  execute: async (
    _context: TOperationContext,
    target: TCommentTarget,
    body: string,
  ): Promise<TUpdatedCommentResult> => {
    const result = await browserGraphQLRequest(commentsSchema.updateComment, {
      comment: target.commentPath,
      body,
      commandId: _context.commandId,
    })
    if (!result.updateComment) throw new Error('Update comment response is empty')
    return result.updateComment as unknown as TUpdatedCommentResult
  },
  reconcile: (
    context: TOperationContext,
    target: TCommentTarget,
    _body: string,
    result: TUpdatedCommentResult,
  ): void => {
    patchCommentEverywhere(context.queryClient, target.scope, target.commentInnerId, (comment) => ({
      ...comment,
      ...stripCommentViewerState(result),
    }))
    if (result.article) {
      patchArticleEverywhere(context.queryClient, target.articlePath, (article) => ({
        ...article,
        ...(typeof result.article?.commentsCount === 'number'
          ? { commentsCount: result.article.commentsCount }
          : {}),
        ...(typeof result.article?.commentsRevision === 'number'
          ? { commentsRevision: result.article.commentsRevision }
          : {}),
      }))
    }
    if (!context.accountRef) return
    writeCommentFeedReceipt({
      type: 'update',
      commandId: context.commandId,
      accountRef: context.accountRef,
      articleKey: target.articleKey,
      commentRef: target.commentInnerId,
      comment: stripCommentViewerState(result),
      publicProjection: {
        commentsCount: result.article?.commentsCount ?? undefined,
        commentsRevision: result.article?.commentsRevision ?? undefined,
      },
    })
  },
}

export const deleteCommentOperation = {
  name: 'comment.delete',
  entityKey: (target: TCommentTarget) => `${target.articleKey}:${target.commentInnerId}`,
  queueKey: (target: TCommentTarget) => commentOperationQueueKey(target),
  queriesToCancel: (context: TOperationContext, target: TCommentTarget) => [
    ...commentQueryTargets(context.queryClient, target.scope),
    ...articleQueryTargets(context.queryClient),
  ],
  apply: (context: TOperationContext, target: TCommentTarget): TOptimisticPlan => {
    const changes = patchCommentChanges(context.queryClient, target, 'innerId', () => null, context)
    changes.push(
      ...patchArticleChanges(
        context.queryClient,
        target.articlePath,
        'commentsCount',
        (article) => ({
          ...article,
          commentsCount: Math.max(0, (article.commentsCount || 0) - 1),
        }),
        context,
      ),
    )
    return { changes, refetchOnFailure: authorityQueries(changes) }
  },
  execute: async (
    _context: TOperationContext,
    target: TCommentTarget,
  ): Promise<TCommentMutationResult> => {
    const result = await browserGraphQLRequest(commentsSchema.deleteComment, {
      comment: target.commentPath,
      commandId: _context.commandId,
    })
    if (!result.deleteComment) throw new Error('Delete comment response is empty')
    return result.deleteComment as unknown as TCommentMutationResult
  },
  reconcile: (
    context: TOperationContext,
    target: TCommentTarget,
    _input: undefined,
    result: TCommentMutationResult,
  ): void => {
    patchCommentEverywhere(context.queryClient, target.scope, target.commentInnerId, () => null)
    if (result.article) {
      patchArticleEverywhere(context.queryClient, target.articlePath, (article) => ({
        ...article,
        ...(typeof result.article?.commentsCount === 'number'
          ? { commentsCount: result.article.commentsCount }
          : {}),
        ...(typeof result.article?.commentsRevision === 'number'
          ? { commentsRevision: result.article.commentsRevision }
          : {}),
      }))
    }
    if (!context.accountRef) return
    writeCommentFeedReceipt({
      type: 'delete',
      commandId: context.commandId,
      accountRef: context.accountRef,
      articleKey: target.articleKey,
      commentRef: target.commentInnerId,
      publicProjection: {
        commentsCount: result.article?.commentsCount ?? undefined,
        commentsRevision: result.article?.commentsRevision ?? undefined,
      },
    })
  },
}
