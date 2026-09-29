'use client'

import type { TArticle, TArticleStats, TArticleViewerState } from '~/spec'
import { getAccountRef } from '~/stores/account/accountRef'
import useAccount from '~/stores/account/hooks'

import { articlePathKey, articlePathOf } from '../articlePath'
import { articleUpvoteOperation } from './article'
import { isArticleUpvoteReceiptNewer, readArticleUpvoteReceipt } from './articleReceipt'
import useOptimisticToggle from './optimistic/useOptimisticToggle'

/** Returns the canonical Article reaction view model and a single toggle action. */
export default function useArticleUpvote(
  article: TArticle | null,
  stats?: TArticleStats | null,
  viewerState?: TArticleViewerState,
) {
  const account = useAccount()
  const { visibleState, toggle } = useOptimisticToggle(articleUpvoteOperation, article)

  const accountRef = account.accountRef || getAccountRef(account.user)
  const entityKey = article ? articlePathKey(articlePathOf(article)) : ''
  const receipt = readArticleUpvoteReceipt(accountRef, entityKey)
  const canonicalStats = stats
  const receiptIsNewer = isArticleUpvoteReceiptNewer(canonicalStats, receipt)
  const visibleReceipt = receiptIsNewer ? receipt : null
  return {
    count: canonicalStats?.upvotesCount ?? 0,
    isUpvoted:
      visibleReceipt?.viewerState.viewerHasUpvoted ??
      viewerState?.viewerHasUpvoted ??
      visibleState ??
      false,
    toggle,
  }
}
