/**
 * Defines the retry-safe optimistic operation for setting Article upvote state.
 *
 *   UI set-state intent
 *     -> optimistic private viewer patch
 *     -> commandId GraphQL mutation
 *     -> committed stats/private reconciliation + confirmed receipt
 *
 * Public counts are never changed optimistically. Failures roll back only tracked private changes;
 * successful payloads remain authoritative even when their two owner revisions differ.
 */
import type { QueryClient } from '@tanstack/react-query'

import { THREAD } from '~/const/thread'
import { browserGraphQLRequest } from '~/graphql/client'
import type { ReactionOutcome } from '~/graphql/generated/graphql'
import type { TArticle } from '~/spec'

import { articlePathKey, articlePathOf, type TArticlePath } from '../../articlePath'
import { articleStatsCache } from '../../articleStats'
import { viewerQueryKeys } from '../../key'
import { articleInteractionStateQueries, type TArticleInteractionState } from '../../viewer'
import {
  isArticleUpvoteReceiptNewer,
  readArticleUpvoteReceipt,
  writeArticleUpvoteReceipt,
} from '../articleReceipt'
import type {
  TOptimisticChange,
  TOptimisticPlan,
  TOptimisticToggleOperation,
  TOperationContext,
  TReadOperationContext,
  TQueryTarget,
} from '../optimistic/types'
import { applyArticleInteractionResult, type TArticleInteractionResult } from './result'
import {
  undoUpvoteBlog,
  undoUpvoteChangelog,
  undoUpvoteDoc,
  undoUpvotePost,
  upvoteBlog,
  upvoteChangelog,
  upvoteDoc,
  upvotePost,
} from './schema'

type TArticleReactionResult = TArticleInteractionResult & {
  reactionOutcome: ReactionOutcome
}

const patchViewerChanges = (
  queryClient: QueryClient,
  accountRef: string,
  articleKey: string,
  nextViewerState: boolean,
  context?: TOperationContext,
): TOptimisticChange[] => {
  const changes: TOptimisticChange[] = []
  const prefix = viewerQueryKeys.articleInteractionStatePrefix(accountRef)
  for (const { queryKey } of queryClient.getQueryCache().findAll({ queryKey: prefix })) {
    const previous = queryClient.getQueryData<Record<string, TArticleInteractionState>>(queryKey)
    const before = previous?.[articleKey]?.viewerHasUpvoted
    if (!previous || typeof before !== 'boolean') continue
    const next = {
      ...previous,
      [articleKey]: { ...previous[articleKey], articleKey, viewerHasUpvoted: nextViewerState },
    }
    queryClient.setQueryData(queryKey, next)
    if (!context) continue
    changes.push({
      type: 'field',
      queryKey,
      entityKey: articleKey,
      field: 'viewerHasUpvoted',
      before,
      optimistic: nextViewerState,
      commandId: context.commandId,
      rollback: 'restore-if-owned',
      restore: () => {
        queryClient.setQueryData<Record<string, TArticleInteractionState>>(queryKey, (current) =>
          current?.[articleKey]
            ? {
                ...current,
                [articleKey]: { ...current[articleKey], viewerHasUpvoted: before },
              }
            : current,
        )
      },
    })
  }
  return changes
}

const requestArticleReaction = async (
  path: TArticlePath,
  nextViewerState: boolean,
  commandId: string,
): Promise<TArticleReactionResult> => {
  const variables = { article: path, commandId }
  const request = (document: unknown) =>
    browserGraphQLRequest<Record<string, TArticleReactionResult | null>, typeof variables>(
      document as never,
      variables,
    )
  const result =
    path.thread === THREAD.BLOG
      ? nextViewerState
        ? (await request(upvoteBlog)).upvoteBlog
        : (await request(undoUpvoteBlog)).undoUpvoteBlog
      : path.thread === THREAD.CHANGELOG
        ? nextViewerState
          ? (await request(upvoteChangelog)).upvoteChangelog
          : (await request(undoUpvoteChangelog)).undoUpvoteChangelog
        : path.thread === THREAD.DOC
          ? nextViewerState
            ? (await request(upvoteDoc)).upvoteDoc
            : (await request(undoUpvoteDoc)).undoUpvoteDoc
          : nextViewerState
            ? (await request(upvotePost)).upvotePost
            : (await request(undoUpvotePost)).undoUpvotePost
  if (!result) throw new Error('Article upvote response is empty')
  return result as TArticleReactionResult
}

/** Serialized optimistic upvote operation with private rollback and committed reconciliation. */
export const articleUpvoteOperation = {
  name: 'article.upvote',
  entityKey: (article: TArticle) => articlePathKey(articlePathOf(article)),
  queueKey: (article: TArticle) => `article:${articlePathKey(articlePathOf(article))}:reaction`,
  read: (context: TReadOperationContext, article: TArticle): boolean => {
    const articleKey = articlePathKey(articlePathOf(article))
    const receipt = readArticleUpvoteReceipt(context.accountRef, articleKey)
    const stats = articleStatsCache.find(context.queryClient, articlePathOf(article))
    if (receipt && isArticleUpvoteReceiptNewer(stats, receipt))
      return receipt.viewerState.viewerHasUpvoted
    if (context.accountRef) {
      const viewer = context.queryClient
        .getQueryCache()
        .findAll({ queryKey: viewerQueryKeys.articleInteractionStatePrefix(context.accountRef) })
        .map(({ queryKey }) =>
          context.queryClient.getQueryData<Record<string, TArticleInteractionState>>(queryKey),
        )
        .find((states) => typeof states?.[articleKey]?.viewerHasUpvoted === 'boolean')
      if (viewer) return Boolean(viewer[articleKey]?.viewerHasUpvoted)
    }
    return false
  },
  queriesToCancel: (context: TOperationContext, article: TArticle): readonly TQueryTarget[] => [
    ...articleStatsCache
      .queries(context.queryClient, articlePathOf(article))
      .map(({ queryKey }) => ({ queryKey, exact: true as const })),
    ...(context.accountRef
      ? articleInteractionStateQueries(
          context.queryClient,
          context.accountRef,
          articlePathOf(article),
        ).map(({ queryKey }) => ({ queryKey, exact: true }))
      : []),
  ],
  apply: (
    context: TOperationContext,
    article: TArticle,
    nextViewerState: boolean,
  ): TOptimisticPlan => {
    const path = articlePathOf(article)
    const articleKey = articlePathKey(path)
    const changes: TOptimisticChange[] = []
    if (context.accountRef) {
      changes.push(
        ...patchViewerChanges(
          context.queryClient,
          context.accountRef,
          articleKey,
          nextViewerState,
          context,
        ),
      )
    }
    return {
      changes,
      refetchOnFailure: [],
    }
  },
  execute: (context: TOperationContext, article: TArticle, nextViewerState: boolean) =>
    requestArticleReaction(articlePathOf(article), nextViewerState, context.commandId),
  reconcile: (
    context: TOperationContext,
    article: TArticle,
    nextViewerState: boolean,
    result: TArticleReactionResult,
  ) => {
    const path = articlePathOf(article)
    const key = articlePathKey(path)
    const { interactionState } = applyArticleInteractionResult(
      context.queryClient,
      context.accountRef,
      path,
      result,
    )
    const viewerHasUpvoted = interactionState.viewerHasUpvoted
    if (context.accountRef && result.reactionOutcome !== 'UNCHANGED') {
      writeArticleUpvoteReceipt({
        accountRef: context.accountRef,
        entityKey: key,
        commandId: context.commandId,
        viewerHasUpvoted,
        interactionRevision: interactionState.interactionRevision,
        viewerHasCollected: interactionState.viewerHasCollected,
        viewerEmotion: interactionState.viewerEmotion,
      })
    }
  },
} satisfies TOptimisticToggleOperation<TArticle, TArticleReactionResult>
