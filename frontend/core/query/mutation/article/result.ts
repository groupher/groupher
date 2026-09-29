/**
 * Reconciles the two independently read owners returned by an Article interaction mutation.
 *
 *   GraphQL mutation payload
 *     -> normalize public ArticleStats
 *     -> normalize private InteractionState
 *     -> patch existing stats and viewer queries independently
 *
 * Public and private revisions may differ because their post-commit readers do not share a database
 * snapshot. This module preserves both revisions and never synthesizes equality between them.
 */
import type { QueryClient } from '@tanstack/react-query'

import type { TArticleStats } from '~/spec'

import { articlePathKey, type TArticlePath } from '../../articlePath'
import { articleStatsCache, normalizeArticleStats } from '../../articleStats'
import type { TArticleStatsResponse } from '../../articleStatsNormalize'
import { cacheArticleInteractionState, type TArticleInteractionState } from '../../viewer'

export type TArticleInteractionResult = {
  commandId: string
  articleStats: TArticleStatsResponse
  interactionState: Omit<TArticleInteractionState, 'articleKey'>
}

/** Normalizes and patches committed public/private owners while preserving their own revisions. */
export const applyArticleInteractionResult = (
  queryClient: QueryClient,
  accountRef: string | null,
  path: TArticlePath,
  result: TArticleInteractionResult,
): { stats: TArticleStats; interactionState: TArticleInteractionState } => {
  const stats = normalizeArticleStats(result.articleStats)
  const interactionState = {
    ...result.interactionState,
    articleKey: articlePathKey(path),
    innerId: String(result.interactionState.innerId),
  } as TArticleInteractionState

  articleStatsCache.apply(queryClient, stats)
  if (accountRef) cacheArticleInteractionState(queryClient, accountRef, interactionState)

  return { stats, interactionState }
}
