'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import type { TArticle } from '~/spec'
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
export default function useArticleUpvote(article: TArticle | null) {
  const queryClient = useQueryClient()
  const account = useAccount()
  const canonical = selectArticleFromCache(queryClient, article)
  const { visibleState, toggle } = useOptimisticToggle(articleUpvoteOperation, canonical)

  const accountRef = account.accountRef || getAccountRef(account.user)
  const entityKey = article
    ? `${article.community.slug}:${article.meta.thread}:${String(article.innerId)}`
    : ''
  const receipt = readArticleUpvoteReceipt(accountRef, entityKey)
  const receiptIsNewer = isArticleUpvoteReceiptNewer(canonical, receipt)
  const visibleReceipt = receiptIsNewer ? receipt : null
  const receiptRevision = receipt?.publicProjection.articleInteractionRevision
  useEffect(() => {
    if (
      visibleReceipt &&
      typeof receiptRevision === 'number' &&
      typeof canonical?.articleInteractionRevision === 'number' &&
      canonical.articleInteractionRevision >= receiptRevision
    ) {
      clearArticleUpvoteReceipt(accountRef, entityKey)
    }
  }, [
    accountRef,
    canonical?.articleInteractionRevision,
    entityKey,
    receiptRevision,
    visibleReceipt,
  ])
  return {
    count: visibleReceipt?.publicProjection.upvotesCount ?? canonical?.upvotesCount ?? 0,
    isUpvoted: visibleReceipt?.viewerState.viewerHasUpvoted ?? visibleState ?? false,
    toggle,
  }
}
