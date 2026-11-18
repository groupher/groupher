import type { TArticle } from '~/spec'

import { articlePathOf } from '../../articlePath'
import { articleStatsCache } from '../../articleStats'
import { articleInteractionStateQueries } from '../../viewer'
import type { TAuthorityTarget, TOperationContext } from '../optimistic/types'

/** Resolves the public and viewer query projections reconciled by article interactions. */
export const articleInteractionAuthorityTargets = (
  context: TOperationContext,
  article: TArticle,
): readonly TAuthorityTarget[] => [
  ...articleStatsCache
    .queries(context.queryClient, articlePathOf(article))
    .map(({ queryKey }) => ({ queryKey })),
  ...(context.accountScope
    ? articleInteractionStateQueries(
        context.queryClient,
        context.accountScope,
        articlePathOf(article),
      ).map(({ queryKey }) => ({ queryKey }))
    : []),
]
