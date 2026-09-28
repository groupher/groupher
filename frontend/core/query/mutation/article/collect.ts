/**
 * Defines the retry-safe operation for Article collection membership.
 *
 *   folder + Article + desired membership
 *     -> commandId GraphQL mutation
 *     -> committed folder result
 *     -> independent ArticleStats / InteractionState cache patches
 *
 * Collection facts and command replay stay on the backend; this module performs no speculative
 * public count update and patches only already-existing matching queries.
 */
import type { QueryClient } from '@tanstack/react-query'

import { browserGraphQLRequest } from '~/graphql/client'
import type { TArticle } from '~/spec'

import { articlePathKey, articlePathOf } from '../../articlePath'
import { articleStatsCache } from '../../articleStats'
import { executeOptimisticOperation } from '../optimistic/execute'
import type { TOptimisticOperation, TOperationContext } from '../optimistic/types'
import { applyArticleInteractionResult, type TArticleInteractionResult } from './result'
import { addToCollect, removeFromCollect } from './schema'

type TArticleCollectTarget = { article: TArticle; folderId: string }
type TCollectFolder = Record<string, unknown> & { id?: string | number | null }
type TArticleCollectResult = TArticleInteractionResult & { folder: TCollectFolder }

const requestArticleCollect = async (
  context: TOperationContext,
  target: TArticleCollectTarget,
  next: boolean,
): Promise<TArticleCollectResult> => {
  const variables = {
    article: articlePathOf(target.article),
    folderId: target.folderId,
    commandId: context.commandId,
  }
  const result = next
    ? (await browserGraphQLRequest(addToCollect, variables)).addToCollect
    : (await browserGraphQLRequest(removeFromCollect, variables)).removeFromCollect
  if (!result) throw new Error('Article collect response is empty')
  return result as unknown as TArticleCollectResult
}

/** Command-backed collect operation used by the generic optimistic executor. */
export const articleCollectOperation = {
  name: 'article.collect',
  entityKey: (target: TArticleCollectTarget) => articlePathKey(articlePathOf(target.article)),
  queueKey: (target: TArticleCollectTarget) =>
    `article:${articlePathKey(articlePathOf(target.article))}:collect:${target.folderId}`,
  queriesToCancel: (context, target) =>
    articleStatsCache
      .queries(context.queryClient, articlePathOf(target.article))
      .map(({ queryKey }) => ({ queryKey, exact: true as const })),
  apply: () => ({ changes: [], refetchOnFailure: [] }),
  execute: requestArticleCollect,
  reconcile: (context, target, _next, result) => {
    applyArticleInteractionResult(
      context.queryClient,
      context.accountRef,
      articlePathOf(target.article),
      result,
    )
  },
} satisfies TOptimisticOperation<TArticleCollectTarget, boolean, TArticleCollectResult>

/** Executes one collect set-state intent and applies its committed folder/public/private payload. */
export const setArticleCollected = (
  queryClient: QueryClient,
  accountRef: string,
  article: TArticle,
  folderId: string,
  next: boolean,
  commandId?: string,
): Promise<TArticleCollectResult> =>
  executeOptimisticOperation({
    queryClient,
    accountRef,
    operation: articleCollectOperation,
    target: { article, folderId },
    input: next,
    commandId,
  })
