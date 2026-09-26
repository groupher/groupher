'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, type ReactNode, useContext, useEffect, useMemo } from 'react'
import { useRef } from 'react'

import { ARTICLE_THREAD } from '~/const/thread'
import {
  isArticleUpvoteReceiptNewer,
  readArticleUpvoteReceipt,
} from '~/query/mutation/articleReceipt'
import { clearArticleViewReceipt, readArticleViewReceipt } from '~/query/viewReceipt'
import type { TArticle, TArticleStats, TArticleThread, TArticleViewerState, TThread } from '~/spec'
import { getAccountRef } from '~/stores/account/accountRef'
import useAccount from '~/stores/account/hooks'

import { isArticleStatsSnapshotStale } from './articleStats'
import { Q } from './client'
import { invalidate, QueryInvalidation } from './invalidation'
import useArticleInteractionReconcile from './useArticleInteractionReconcile'
import type { TViewerArticleRef } from './viewer'

type TValue = {
  article: TArticle | null
  stats: TArticleStats | null
  viewerState: TArticleViewerState
  community: string
  innerId: string
  thread: TThread
}

const ArticleQueryContext = createContext<TValue | null>(null)

/** Reads the strict article server-state context supplied by the route query boundary. */
export const useArticleQueryContext = (): TValue | null => useContext(ArticleQueryContext)

export default function ArticleQueryProvider({
  children,
  community,
  innerId,
  thread,
  initialArticle,
}: {
  children: ReactNode
  community: string
  innerId: string | number
  thread: TThread
  initialArticle?: TArticle | null
}) {
  const account = useAccount()
  const queryClient = useQueryClient()
  const refreshedStats = useRef(false)
  const articleQuery = useQuery({
    ...Q.article.detail(community, thread, innerId),
    initialData: initialArticle || undefined,
  })
  const isArticleThread = Object.values(ARTICLE_THREAD).includes(thread as TArticleThread)
  const articleStatsQuery = useQuery({
    ...Q.article.stats(community, thread as TArticleThread, innerId),
    enabled: isArticleThread,
  })
  useEffect(() => {
    if (
      !articleStatsQuery.data ||
      refreshedStats.current ||
      !isArticleStatsSnapshotStale(articleStatsQuery.data.snapshotAt)
    )
      return
    refreshedStats.current = true
    void invalidate(
      queryClient,
      QueryInvalidation.article.stats({
        community,
        thread: thread as TArticleThread,
        innerId,
      }),
    )
  }, [articleStatsQuery.data, community, innerId, queryClient, thread])
  const articleRef = {
    community,
    thread,
    innerId: String(innerId),
  } satisfies TViewerArticleRef
  const viewerQuery = useQuery(
    Q.viewer.articleStates(account.accountRef || getAccountRef(account.user) || '', [articleRef]),
  )
  const interactionQuery = useQuery(
    Q.viewer.articleInteractionStates(account.accountRef || getAccountRef(account.user) || '', [
      articleRef,
    ]),
  )
  useEffect(() => {
    const key = `${community}:${thread}:${String(innerId)}`
    if (viewerQuery.data?.[key]?.viewerHasViewed === true) clearArticleViewReceipt(key)
  }, [community, innerId, thread, viewerQuery.data])
  useArticleInteractionReconcile(articleQuery.data ? [articleQuery.data] : [])
  const viewerState = useMemo<TArticleViewerState>(() => {
    const key = `${community}:${thread}:${String(innerId)}`
    const base = {
      articleKey: key,
      ...viewerQuery.data?.[key],
      ...interactionQuery.data?.[key],
    }
    const viewReceipt = readArticleViewReceipt(key)
    const viewed = viewReceipt ? { ...base, viewerHasViewed: true } : base
    const accountRef = account.accountRef || getAccountRef(account.user)
    const receipt = readArticleUpvoteReceipt(accountRef, key)
    return isArticleUpvoteReceiptNewer(articleStatsQuery.data, receipt)
      ? { ...viewed, ...receipt?.viewerState, interactionRevision: receipt?.interactionRevision }
      : viewed
  }, [
    account.accountRef,
    account.user,
    community,
    innerId,
    thread,
    articleStatsQuery.data,
    interactionQuery.data,
    viewerQuery.data,
  ])
  const value = useMemo(
    () => ({
      article: articleQuery.data || null,
      stats: articleStatsQuery.data || null,
      viewerState,
      community,
      innerId: String(innerId),
      thread,
    }),
    [articleQuery.data, articleStatsQuery.data, community, innerId, thread, viewerState],
  )

  return <ArticleQueryContext.Provider value={value}>{children}</ArticleQueryContext.Provider>
}
