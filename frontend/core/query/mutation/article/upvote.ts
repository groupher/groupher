/**
 * Defines the retry-safe optimistic operation for setting Article upvote state.
 *
 *   UI set-state intent
 *     -> optimistic private viewer + active public count patches
 *     -> commandId GraphQL mutation
 *     -> committed stats/private reconciliation + confirmed receipt
 *
 * Public counts are only patched in active queries and converge through an authority refetch on
 * failure. Successful payloads remain authoritative even when their two owner revisions differ.
 */
import type { QueryClient } from '@tanstack/react-query'

import { THREAD } from '~/const/thread'
import { browserGraphQLRequest } from '~/graphql/client'
import type { ReactionOutcome } from '~/graphql/generated/graphql'
import type { TArticle, TArticleStats } from '~/spec'

import { articlePathKey, articlePathOf, type TArticlePath } from '../../articlePath'
import { articleStatsCache, sameArticle } from '../../articleStats'
import { viewerQueryKeys } from '../../key'
import { articleInteractionStateQueries, type TArticleInteractionState } from '../../viewer'
import {
  isArticleUpvoteReceiptNewer,
  readArticleUpvoteReceipt,
  writeArticleUpvoteReceipt,
} from '../articleReceipt'
import type {
  TAuthorityRefetch,
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

type TStatsCacheValue = TArticleStats | TArticleStats[]
type TStatsCacheQuery = ReturnType<typeof articleStatsCache.queries>[number]

const patchOptimisticStats = (
  query: TStatsCacheQuery,
  update: (current: TStatsCacheValue | undefined) => TStatsCacheValue | undefined,
): void => {
  const current = query.state.data as TStatsCacheValue | undefined
  const next = update(current)
  if (next !== current) query.setState({ data: next })
}

const patchActiveStatsChanges = (
  queryClient: QueryClient,
  path: TArticlePath,
  nextViewerState: boolean,
  context: TOperationContext,
): Pick<TOptimisticPlan, 'changes' | 'refetchOnFailure'> => {
  const changes: TOptimisticChange[] = []
  const refetchOnFailure: TAuthorityRefetch[] = []
  const articleKey = articlePathKey(path)

  for (const query of articleStatsCache.queries(queryClient, path)) {
    if (!query.isActive()) continue
    const previous = query.state.data as TStatsCacheValue | undefined
    const target = Array.isArray(previous)
      ? previous.find((stats) => sameArticle(stats, path))
      : previous
    if (!target || !sameArticle(target, path)) continue

    const before = target.upvotesCount
    const beforeRevision = target.interactionRevision
    const optimistic = Math.max(0, before + (nextViewerState ? 1 : -1))
    if (optimistic === before) continue

    patchOptimisticStats(query, (current) => {
      if (Array.isArray(current)) {
        return current.map((stats) =>
          sameArticle(stats, path) ? { ...stats, upvotesCount: optimistic } : stats,
        )
      }
      return current && sameArticle(current, path)
        ? { ...current, upvotesCount: optimistic }
        : current
    })
    changes.push({
      type: 'field',
      queryKey: query.queryKey,
      entityKey: articleKey,
      field: 'upvotesCount',
      before,
      optimistic,
      commandId: context.commandId,
      // Restore the still-owned optimistic value before refetching. Without this guarded restore,
      // ArticleStats structural sharing rejects the equal-revision authority count as a conflict.
      rollback: 'restore-if-owned',
      restore: () => {
        patchOptimisticStats(query, (current) => {
          if (Array.isArray(current)) {
            return current.map((stats) =>
              sameArticle(stats, path) &&
              stats.upvotesCount === optimistic &&
              stats.interactionRevision === beforeRevision
                ? { ...stats, upvotesCount: before }
                : stats,
            )
          }
          return current &&
            sameArticle(current, path) &&
            current.upvotesCount === optimistic &&
            current.interactionRevision === beforeRevision
            ? { ...current, upvotesCount: before }
            : current
        })
      },
    })
    refetchOnFailure.push({ queryKey: query.queryKey, exact: true })
  }

  return { changes, refetchOnFailure }
}

const patchViewerChanges = (
  queryClient: QueryClient,
  accountScope: string,
  articleKey: string,
  nextViewerState: boolean,
  context?: TOperationContext,
): TOptimisticChange[] => {
  const changes: TOptimisticChange[] = []
  const prefix = viewerQueryKeys.articleInteractionStatePrefix(accountScope)
  for (const { queryKey } of queryClient.getQueryCache().findAll({ queryKey: prefix })) {
    const previous = queryClient.getQueryData<Record<string, TArticleInteractionState>>(queryKey)
    const before = previous?.[articleKey]?.viewerHasUpvoted
    const beforeRevision = previous?.[articleKey]?.interactionRevision
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
          current?.[articleKey]?.viewerHasUpvoted === nextViewerState &&
          current[articleKey].interactionRevision === beforeRevision
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
    const receipt = readArticleUpvoteReceipt(context.accountScope, articleKey)
    const stats = articleStatsCache.find(context.queryClient, articlePathOf(article))
    if (receipt && isArticleUpvoteReceiptNewer(stats, receipt))
      return receipt.viewerState.viewerHasUpvoted
    if (context.accountScope) {
      const viewer = context.queryClient
        .getQueryCache()
        .findAll({ queryKey: viewerQueryKeys.articleInteractionStatePrefix(context.accountScope) })
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
    ...(context.accountScope
      ? articleInteractionStateQueries(
          context.queryClient,
          context.accountScope,
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
    const statsPlan = patchActiveStatsChanges(context.queryClient, path, nextViewerState, context)
    const changes: TOptimisticChange[] = [...statsPlan.changes]
    if (context.accountScope) {
      changes.push(
        ...patchViewerChanges(
          context.queryClient,
          context.accountScope,
          articleKey,
          nextViewerState,
          context,
        ),
      )
    }
    return {
      changes,
      refetchOnFailure: statsPlan.refetchOnFailure,
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
      context.accountScope,
      path,
      result,
    )
    const viewerHasUpvoted = interactionState.viewerHasUpvoted
    if (context.accountScope && result.reactionOutcome !== 'UNCHANGED') {
      writeArticleUpvoteReceipt({
        accountScope: context.accountScope,
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
