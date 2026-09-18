import type { QueryClient } from '@tanstack/react-query'

import { THREAD } from '~/const/thread'
import { browserGraphQLRequest } from '~/graphql/client'
import type { TArticle, TEmotion, TUser } from '~/spec'

import { articleKeys, viewerKeys } from '../../key'
import type { TArticleViewerState } from '../../viewer'
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
import { articleKeyFor, articlePath, articleStatsQueryTargets, type TArticlePath } from './cache'
import {
  undoUpvoteChangelog,
  undoUpvoteDoc,
  undoUpvotePost,
  upvoteChangelog,
  upvoteDoc,
  upvotePost,
} from './schema'

type TArticleReactionResult = {
  innerId: string | number
  articleStats?: { upvotesCount: number } | null
  collectsCount?: number | null
  articleInteractionRevision?: number | null
  reactionOutcome?: string | null
  emotions?: Array<Pick<TEmotion, 'type' | 'count' | 'latestUsers'> | null> | null
  viewerHasCollected?: boolean | null
  viewerEmotion?: string | null
  viewerHasUpvoted?: boolean | null
  meta?: {
    latestUpvotedUsers?: Array<Pick<TUser, 'login' | 'nickname' | 'avatar'>> | null
  } | null
}

const patchViewerChanges = (
  queryClient: QueryClient,
  accountRef: string,
  articleKey: string,
  nextViewerState: boolean,
  context?: TOperationContext,
): TOptimisticChange[] => {
  const changes: TOptimisticChange[] = []
  const prefix = viewerKeys.articleStatePrefix(accountRef)
  for (const { queryKey } of queryClient.getQueryCache().findAll({ queryKey: prefix })) {
    const previous = queryClient.getQueryData<Record<string, TArticleViewerState>>(queryKey)
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
        queryClient.setQueryData<Record<string, TArticleViewerState>>(queryKey, (current) =>
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
    path.thread === THREAD.CHANGELOG
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

const patchViewerState = (
  queryClient: QueryClient,
  accountRef: string,
  articleKey: string,
  state: Pick<TArticleViewerState, 'viewerHasUpvoted' | 'viewerHasCollected' | 'viewerEmotion'>,
): void => {
  queryClient.setQueriesData<Record<string, TArticleViewerState>>(
    { queryKey: viewerKeys.articleStatePrefix(accountRef) },
    (states) =>
      states
        ? {
            ...states,
            [articleKey]: { ...states[articleKey], articleKey, ...state },
          }
        : states,
  )
}

export const articleUpvoteOperation = {
  name: 'article.upvote',
  entityKey: (article: TArticle) => articleKeyFor(articlePath(article)),
  queueKey: (article: TArticle) => `article:${articleKeyFor(articlePath(article))}:reaction`,
  read: (context: TReadOperationContext, article: TArticle): boolean => {
    const articleKey = articleKeyFor(articlePath(article))
    const receipt = readArticleUpvoteReceipt(context.accountRef, articleKey)
    if (receipt && isArticleUpvoteReceiptNewer(article, receipt))
      return receipt.viewerState.viewerHasUpvoted
    if (context.accountRef) {
      const viewer = context.queryClient
        .getQueryCache()
        .findAll({ queryKey: viewerKeys.articleStatePrefix(context.accountRef) })
        .map(({ queryKey }) =>
          context.queryClient.getQueryData<Record<string, TArticleViewerState>>(queryKey),
        )
        .find((states) => typeof states?.[articleKey]?.viewerHasUpvoted === 'boolean')
      if (viewer) return Boolean(viewer[articleKey]?.viewerHasUpvoted)
    }
    return Boolean(article.viewerHasUpvoted)
  },
  queriesToCancel: (context: TOperationContext): readonly TQueryTarget[] => [
    ...articleStatsQueryTargets(context.queryClient),
    ...(context.accountRef
      ? context.queryClient
          .getQueryCache()
          .findAll({ queryKey: viewerKeys.articleStatePrefix(context.accountRef) })
          .map(({ queryKey }) => ({ queryKey, exact: true }))
      : []),
  ],
  apply: (
    context: TOperationContext,
    article: TArticle,
    nextViewerState: boolean,
  ): TOptimisticPlan => {
    const path = articlePath(article)
    const articleKey = articleKeyFor(path)
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
    requestArticleReaction(articlePath(article), nextViewerState, context.commandId),
  reconcile: (
    context: TOperationContext,
    article: TArticle,
    nextViewerState: boolean,
    result: TArticleReactionResult,
  ) => {
    const path = articlePath(article)
    const key = articleKeyFor(path)
    const viewerHasUpvoted =
      typeof result.viewerHasUpvoted === 'boolean' ? result.viewerHasUpvoted : nextViewerState
    void context.queryClient.invalidateQueries({
      queryKey: articleKeys.articleStats(path.community, path.thread, path.innerId),
    })
    if (context.accountRef) {
      patchViewerState(context.queryClient, context.accountRef, key, {
        viewerHasUpvoted,
        ...(typeof result.viewerHasCollected === 'boolean'
          ? { viewerHasCollected: result.viewerHasCollected }
          : {}),
        ...(result.viewerEmotion !== undefined ? { viewerEmotion: result.viewerEmotion } : {}),
      })
    }
    if (
      context.accountRef &&
      typeof result.articleStats?.upvotesCount === 'number' &&
      result.reactionOutcome !== 'unchanged'
    ) {
      writeArticleUpvoteReceipt({
        accountRef: context.accountRef,
        entityKey: key,
        commandId: context.commandId,
        upvotesCount: result.articleStats.upvotesCount,
        viewerHasUpvoted,
        collectsCount: typeof result.collectsCount === 'number' ? result.collectsCount : undefined,
        articleInteractionRevision:
          typeof result.articleInteractionRevision === 'number'
            ? result.articleInteractionRevision
            : undefined,
        emotions: Array.isArray(result.emotions) ? result.emotions : undefined,
        latestUpvotedUsers: Array.isArray(result.meta?.latestUpvotedUsers)
          ? result.meta.latestUpvotedUsers
          : undefined,
        viewerHasCollected:
          typeof result.viewerHasCollected === 'boolean' ? result.viewerHasCollected : undefined,
        viewerEmotion: result.viewerEmotion,
      })
    }
  },
} satisfies TOptimisticToggleOperation<TArticle, TArticleReactionResult>
