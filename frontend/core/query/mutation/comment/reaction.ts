import { browserGraphQLRequest } from '~/graphql/client'
import type { TCommentViewerStates } from '~/lib/commentViewerState'
import type { TEmotionRawType, TEmotionType } from '~/spec'
import commentsSchema from '~/unit/Comments/schema'

import { viewerQueryKeys } from '../../key'
import { writeCommentReactionReceipt } from '../commentReactionReceipt'
import type { TOperationContext, TReadOperationContext } from '../optimistic/types'
import {
  commentOperationQueueKey,
  commentTargetQueries,
  makeCommentReactionPlan,
  patchCommentEverywhere,
  patchCommentViewerState,
  publicEmotions,
  selectCommentFromCache,
  updateCommentEmotion,
  type TCommentMutationResult,
  type TCommentTarget,
} from './cache'

export const commentUpvoteOperation = {
  name: 'comment.upvote',
  entityKey: (target: TCommentTarget) => `${target.articleKey}:${target.commentInnerId}`,
  queueKey: (target: TCommentTarget) => commentOperationQueueKey(target),
  read: (context: TReadOperationContext, target: TCommentTarget): boolean => {
    if (context.accountRef) {
      const prefix = viewerQueryKeys.commentStatePrefix(context.accountRef, target.articleKey)
      for (const { queryKey } of context.queryClient
        .getQueryCache()
        .findAll({ queryKey: prefix })) {
        const state =
          context.queryClient.getQueryData<TCommentViewerStates>(queryKey)?.[target.commentInnerId]
        if (typeof state?.viewerHasUpvoted === 'boolean') return state.viewerHasUpvoted
      }
    }
    return Boolean(
      selectCommentFromCache(context.queryClient, target.scope, target.comment).viewerHasUpvoted,
    )
  },
  queriesToCancel: commentTargetQueries,
  apply: (context: TOperationContext, target: TCommentTarget, next: boolean) =>
    makeCommentReactionPlan(
      context,
      target,
      'upvotesCount',
      (comment) => ({
        ...comment,
        upvotesCount: Math.max(0, (comment.upvotesCount || 0) + (next ? 1 : -1)),
      }),
      'viewerHasUpvoted',
      next,
    ),
  execute: async (
    _context: TOperationContext,
    target: TCommentTarget,
    next: boolean,
  ): Promise<TCommentMutationResult> => {
    const result = next
      ? (
          await browserGraphQLRequest(commentsSchema.upvoteComment, {
            comment: target.commentPath,
            commandId: _context.commandId,
          })
        ).upvoteComment
      : (
          await browserGraphQLRequest(commentsSchema.undoUpvoteComment, {
            comment: target.commentPath,
            commandId: _context.commandId,
          })
        ).undoUpvoteComment
    if (!result) throw new Error('Comment upvote response is empty')
    return result as unknown as TCommentMutationResult
  },
  reconcile: (
    context: TOperationContext,
    target: TCommentTarget,
    nextViewerState: boolean,
    result: TCommentMutationResult,
  ): void => {
    patchCommentEverywhere(context.queryClient, target.scope, target.commentInnerId, (comment) => ({
      ...comment,
      meta: result.meta,
      upvotesCount: result.upvotesCount,
      ...(typeof result.commentInteractionRevision === 'number'
        ? { commentInteractionRevision: result.commentInteractionRevision }
        : {}),
    }))
    if (context.accountRef) {
      patchCommentViewerState(
        context.queryClient,
        context.accountRef,
        target.articleKey,
        target.commentInnerId,
        (state) => ({
          ...state,
          viewerHasUpvoted:
            typeof result.viewerHasUpvoted === 'boolean'
              ? result.viewerHasUpvoted
              : nextViewerState,
        }),
      )
    }
    if (context.accountRef && result.reactionOutcome !== 'UNCHANGED') {
      writeCommentReactionReceipt({
        commandId: context.commandId,
        accountRef: context.accountRef,
        articleKey: target.articleKey,
        commentRef: target.commentInnerId,
        upvotesCount: result.upvotesCount || 0,
        emotions: publicEmotions(result) || [],
        viewerHasUpvoted:
          typeof result.viewerHasUpvoted === 'boolean' ? result.viewerHasUpvoted : nextViewerState,
        viewerEmotion: (result.emotions || []).find((emotion) => emotion.viewerHasReacted)?.type,
        commentInteractionRevision:
          typeof result.commentInteractionRevision === 'number'
            ? result.commentInteractionRevision
            : undefined,
      })
    }
  },
}

export type TCommentEmotionTarget = TCommentTarget & { emotionName: TEmotionType }

export const commentEmotionOperation = {
  name: 'comment.emotion',
  entityKey: (target: TCommentEmotionTarget) =>
    `${target.articleKey}:${target.commentInnerId}:${target.emotionName.toUpperCase()}`,
  queueKey: (target: TCommentEmotionTarget) => commentOperationQueueKey(target),
  read: (context: TReadOperationContext, target: TCommentEmotionTarget): boolean => {
    if (context.accountRef) {
      const prefix = viewerQueryKeys.commentStatePrefix(context.accountRef, target.articleKey)
      for (const { queryKey } of context.queryClient
        .getQueryCache()
        .findAll({ queryKey: prefix })) {
        const state =
          context.queryClient.getQueryData<TCommentViewerStates>(queryKey)?.[target.commentInnerId]
        const value = state?.emotionFlags[target.emotionName.toUpperCase() as never]
        if (typeof value === 'boolean') return value
      }
    }
    const comment = selectCommentFromCache(context.queryClient, target.scope, target.comment)
    const emotion = (comment.emotions || []).find(
      (item) => item.type === target.emotionName.toUpperCase(),
    )
    return Boolean(emotion?.viewerHasReacted)
  },
  queriesToCancel: commentTargetQueries,
  apply: (context: TOperationContext, target: TCommentEmotionTarget, next: boolean) =>
    makeCommentReactionPlan(
      context,
      target,
      'emotions',
      (comment) => updateCommentEmotion(comment, target.emotionName, next),
      'emotionFlags',
      { name: target.emotionName, enabled: next },
    ),
  execute: async (
    _context: TOperationContext,
    target: TCommentEmotionTarget,
    next: boolean,
  ): Promise<TCommentMutationResult> => {
    const emotion = target.emotionName.toUpperCase() as Exclude<TEmotionRawType, 'UPVOTE'>
    const result = next
      ? (
          await browserGraphQLRequest(commentsSchema.emotionToComment, {
            comment: target.commentPath,
            emotion,
            commandId: _context.commandId,
          })
        ).emotionToComment
      : (
          await browserGraphQLRequest(commentsSchema.undoEmotionToComment, {
            comment: target.commentPath,
            emotion,
            commandId: _context.commandId,
          })
        ).undoEmotionToComment
    if (!result) throw new Error('Comment emotion response is empty')
    return result as unknown as TCommentMutationResult
  },
  reconcile: (
    context: TOperationContext,
    target: TCommentEmotionTarget,
    nextViewerState: boolean,
    result: TCommentMutationResult,
  ): void => {
    patchCommentEverywhere(context.queryClient, target.scope, target.commentInnerId, (comment) => ({
      ...comment,
      emotions: publicEmotions(result),
      ...(typeof result.commentInteractionRevision === 'number'
        ? { commentInteractionRevision: result.commentInteractionRevision }
        : {}),
    }))
    if (context.accountRef) {
      const confirmed = (result.emotions || []).find(
        (emotion) => emotion.type === target.emotionName.toUpperCase(),
      )
      patchCommentViewerState(
        context.queryClient,
        context.accountRef,
        target.articleKey,
        target.commentInnerId,
        (state) => ({
          ...state,
          emotionFlags: {
            ...state.emotionFlags,
            [target.emotionName.toUpperCase()]:
              typeof confirmed?.viewerHasReacted === 'boolean'
                ? confirmed.viewerHasReacted
                : nextViewerState,
          },
        }),
      )
    }
    if (context.accountRef && result.reactionOutcome !== 'UNCHANGED') {
      writeCommentReactionReceipt({
        commandId: context.commandId,
        accountRef: context.accountRef,
        articleKey: target.articleKey,
        commentRef: target.commentInnerId,
        upvotesCount: result.upvotesCount || target.comment.upvotesCount || 0,
        emotions: publicEmotions(result) || [],
        viewerHasUpvoted: Boolean(result.viewerHasUpvoted ?? target.comment.viewerHasUpvoted),
        viewerEmotion: (result.emotions || []).find((emotion) => emotion.viewerHasReacted)?.type,
        commentInteractionRevision:
          typeof result.commentInteractionRevision === 'number'
            ? result.commentInteractionRevision
            : undefined,
      })
    }
  },
}
