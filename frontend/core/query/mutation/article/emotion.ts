/**
 * Defines the retry-safe set-state operation for one Article emotion.
 *
 *   Article + emotion + desired state
 *     -> thread-specific commandId mutation
 *     -> committed ArticleStats / InteractionState payload
 *     -> owner-wise cache reconciliation
 *
 * The backend rejects reserved upvote/collect emotions; this module routes only supported emotion
 * values and does not optimistically invent aggregate emotion counts.
 */
import type { QueryClient } from '@tanstack/react-query'

import { THREAD } from '~/const/thread'
import { browserGraphQLRequest } from '~/graphql/client'
import type { ReactionOutcome } from '~/graphql/generated/graphql'
import type { TArticle, TEmotionType } from '~/spec'

import { articlePathKey, articlePathOf } from '../../articlePath'
import { articleStatsCache } from '../../articleStats'
import { executeOptimisticOperation } from '../optimistic/execute'
import type { TOptimisticOperation, TOperationContext } from '../optimistic/types'
import { applyArticleInteractionResult, type TArticleInteractionResult } from './result'
import {
  emotionToBlog,
  emotionToChangelog,
  emotionToDoc,
  emotionToPost,
  undoEmotionToBlog,
  undoEmotionToChangelog,
  undoEmotionToDoc,
  undoEmotionToPost,
} from './schema'

type TArticleEmotionTarget = { article: TArticle; emotion: TEmotionType }
type TArticleEmotionResult = TArticleInteractionResult & { reactionOutcome: ReactionOutcome }

const requestArticleEmotion = async (
  context: TOperationContext,
  target: TArticleEmotionTarget,
  next: boolean,
): Promise<TArticleEmotionResult> => {
  const path = articlePathOf(target.article)
  const variables = {
    article: path,
    emotion: target.emotion.toUpperCase(),
    commandId: context.commandId,
  }
  const request = (document: unknown) =>
    browserGraphQLRequest<Record<string, TArticleEmotionResult | null>, typeof variables>(
      document as never,
      variables,
    )

  const result =
    path.thread === THREAD.BLOG
      ? next
        ? (await request(emotionToBlog)).emotionToBlog
        : (await request(undoEmotionToBlog)).undoEmotionToBlog
      : path.thread === THREAD.CHANGELOG
        ? next
          ? (await request(emotionToChangelog)).emotionToChangelog
          : (await request(undoEmotionToChangelog)).undoEmotionToChangelog
        : path.thread === THREAD.DOC
          ? next
            ? (await request(emotionToDoc)).emotionToDoc
            : (await request(undoEmotionToDoc)).undoEmotionToDoc
          : next
            ? (await request(emotionToPost)).emotionToPost
            : (await request(undoEmotionToPost)).undoEmotionToPost

  if (!result) throw new Error('Article emotion response is empty')
  return result
}

/** Thread-aware emotion operation used by the generic optimistic executor. */
export const articleEmotionOperation = {
  name: 'article.emotion',
  entityKey: (target: TArticleEmotionTarget) =>
    `${articlePathKey(articlePathOf(target.article))}:${target.emotion}`,
  queueKey: (target: TArticleEmotionTarget) =>
    `article:${articlePathKey(articlePathOf(target.article))}:reaction`,
  queriesToCancel: (context, target) =>
    articleStatsCache
      .queries(context.queryClient, articlePathOf(target.article))
      .map(({ queryKey }) => ({ queryKey, exact: true as const })),
  apply: () => ({ changes: [], refetchOnFailure: [] }),
  execute: requestArticleEmotion,
  reconcile: (context, target, _next, result) => {
    applyArticleInteractionResult(
      context.queryClient,
      context.accountRef,
      articlePathOf(target.article),
      result,
    )
  },
} satisfies TOptimisticOperation<TArticleEmotionTarget, boolean, TArticleEmotionResult>

/** Executes one emotion set-state intent and applies the committed public/private projections. */
export const setArticleEmotion = (
  queryClient: QueryClient,
  accountRef: string,
  article: TArticle,
  emotion: TEmotionType,
  next: boolean,
  commandId?: string,
): Promise<TArticleEmotionResult> =>
  executeOptimisticOperation({
    queryClient,
    accountRef,
    operation: articleEmotionOperation,
    target: { article, emotion },
    input: next,
    commandId,
  })
