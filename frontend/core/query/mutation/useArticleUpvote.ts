'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import type { TArticle, TArticleStats, TArticleViewerState } from '~/spec'
import { getAccountRef } from '~/stores/account/accountRef'
import useAccount from '~/stores/account/hooks'

import { articleUpvoteOperation, selectArticleFromCache } from './article'
import {
  clearArticleUpvoteReceipt,
  isArticleUpvoteReceiptNewer,
  readArticleUpvoteReceipt,
} from './articleReceipt'
import useOptimisticToggle from './optimistic/useOptimisticToggle'

/** Returns the canonical Article reaction view model and a single toggle action. */
export default function useArticleUpvote(
  article: TArticle | null,
  stats?: TArticleStats | null,
  viewerState?: TArticleViewerState,
) {
  const queryClient = useQueryClient()
  const account = useAccount()
  const canonical = selectArticleFromCache(queryClient, article)
  const { visibleState, toggle } = useOptimisticToggle(articleUpvoteOperation, canonical)

  const accountRef = account.accountRef || getAccountRef(account.user)
  const entityKey = article
    ? `${article.community.slug}:${article.meta.thread}:${String(article.innerId)}`
    : ''
  const receipt = readArticleUpvoteReceipt(accountRef, entityKey)
  const canonicalStats = stats
  const receiptIsNewer = isArticleUpvoteReceiptNewer(canonicalStats, receipt)
  const visibleReceipt = receiptIsNewer ? receipt : null
  const receiptRevision = receipt?.interactionRevision
  useEffect(() => {
    if (
      visibleReceipt &&
      typeof receiptRevision === 'number' &&
      typeof canonicalStats?.interactionRevision === 'number' &&
      canonicalStats.interactionRevision >= receiptRevision
    ) {
      clearArticleUpvoteReceipt(accountRef, entityKey)
    }
  }, [accountRef, canonicalStats?.interactionRevision, entityKey, receiptRevision, visibleReceipt])
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
