'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

import type { TArticle } from '~/spec'
import { getAccountRef } from '~/stores/account/accountRef'
import useAccount from '~/stores/account/hooks'

import { Q } from './client'
import { viewerKeys } from './key'
import { articleKeys } from './key'
import {
  isArticleUpvoteReceiptNewer,
  readArticleUpvoteReceipt,
  clearArticleUpvoteReceipt,
} from './mutation/articleReceipt'
import type { TArticleInteractionState, TArticleViewerState } from './viewer'

type TArticleRef = {
  community: string
  thread: TArticle['meta']['thread']
  innerId: string
}

const toRef = (article: TArticle): TArticleRef => ({
  community: article.community.slug,
  thread: article.meta.thread,
  innerId: String(article.innerId),
})

const toKey = (ref: TArticleRef): string => `${ref.community}:${ref.thread}:${ref.innerId}`

const mergePrivateState = (
  queryClient: ReturnType<typeof useQueryClient>,
  accountRef: string,
  state: TArticleInteractionState,
): void => {
  const key = state.articleKey
  queryClient.setQueriesData<Record<string, TArticleViewerState>>(
    { queryKey: viewerKeys.articleStatePrefix(accountRef) },
    (previous) => {
      if (!previous) return previous
      return {
        ...previous,
        [key]: {
          ...(previous[key] || { articleKey: key }),
          articleKey: key,
          viewerHasUpvoted: state.viewerHasUpvoted,
          viewerHasCollected: state.viewerHasCollected,
          viewerEmotion: state.viewerEmotion,
        },
      }
    },
  )
}

/** Reconciles only Articles with active confirmed receipts through a private no-store query. */
export default function useArticleInteractionReconcile(articles: readonly TArticle[] | undefined) {
  const queryClient = useQueryClient()
  const account = useAccount()
  const accountRef = account.accountRef || getAccountRef(account.user)

  const refs = useMemo(() => {
    if (!accountRef) return []
    const unique = new Map<string, TArticleRef>()
    for (const article of articles || []) {
      const ref = toRef(article)
      const key = toKey(ref)
      const receipt = readArticleUpvoteReceipt(accountRef, key)
      if (isArticleUpvoteReceiptNewer(article, receipt)) unique.set(key, ref)
    }
    return [...unique.values()]
  }, [accountRef, articles])

  const query = useQuery(Q.viewer.articleInteractionStates(accountRef || '', refs))

  useEffect(() => {
    if (!accountRef || !query.data) return
    for (const state of Object.values(query.data)) {
      const ref: TArticleRef = {
        community: state.community,
        thread: state.thread as TArticleRef['thread'],
        innerId: String(state.innerId),
      }
      const key = toKey(ref)
      const receipt = readArticleUpvoteReceipt(accountRef, key)
      if (!receipt) continue
      const receiptRevision = receipt.publicProjection.articleInteractionRevision
      mergePrivateState(queryClient, accountRef, state)
      void queryClient.invalidateQueries({
        queryKey: articleKeys.articleStats(ref.community, ref.thread, ref.innerId),
      })
      if (
        typeof receiptRevision !== 'number' ||
        state.articleInteractionRevision >= receiptRevision
      ) {
        clearArticleUpvoteReceipt(accountRef, key)
      }
    }
  }, [accountRef, query.data, queryClient])

  return query
}
