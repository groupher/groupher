'use client'

import { useQuery } from '@tanstack/react-query'
import { createContext, type ReactNode, useContext, useEffect, useMemo } from 'react'

import {
  isArticleUpvoteReceiptNewer,
  overlayArticleUpvoteReceipt,
  readArticleUpvoteReceipt,
} from '~/query/mutation/articleReceipt'
import { clearArticleViewReceipt, readArticleViewReceipt } from '~/query/viewReceipt'
import type { TArticle, TThread } from '~/spec'
import { getAccountRef } from '~/stores/account/accountRef'
import useAccount from '~/stores/account/hooks'

import { Q } from './client'
import useArticleInteractionReconcile from './useArticleInteractionReconcile'
import type { TViewerArticleRef } from './viewer'

type TValue = {
  article: TArticle | null
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
  const articleQuery = useQuery({
    ...Q.article.detail(community, thread, innerId),
    initialData: initialArticle || undefined,
  })
  const articleRef = {
    community,
    thread,
    innerId: String(innerId),
  } satisfies TViewerArticleRef
  const viewerQuery = useQuery(
    Q.viewer.articleStates(account.accountRef || getAccountRef(account.user) || '', [articleRef]),
  )
  useEffect(() => {
    const key = `${community}:${thread}:${String(innerId)}`
    if (viewerQuery.data?.[key]?.viewerHasViewed === true) clearArticleViewReceipt(key)
  }, [community, innerId, thread, viewerQuery.data])
  useArticleInteractionReconcile(articleQuery.data ? [articleQuery.data] : [])
  const article = useMemo(() => {
    if (!articleQuery.data) return null
    const key = `${community}:${thread}:${String(innerId)}`
    const viewerState = viewerQuery.data?.[key]
    const merged = viewerState
      ? ({ ...articleQuery.data, ...viewerState } as TArticle)
      : articleQuery.data
    const viewReceipt = readArticleViewReceipt(key)
    const viewed = viewReceipt ? { ...merged, viewerHasViewed: true } : merged
    const accountRef = account.accountRef || getAccountRef(account.user)
    const receipt = readArticleUpvoteReceipt(accountRef, key)
    return isArticleUpvoteReceiptNewer(viewed, receipt)
      ? overlayArticleUpvoteReceipt(viewed, receipt as NonNullable<typeof receipt>)
      : viewed
  }, [
    account.accountRef,
    account.user,
    articleQuery.data,
    community,
    innerId,
    thread,
    viewerQuery.data,
  ])
  const value = useMemo(
    () => ({
      article,
      community,
      innerId: String(innerId),
      thread,
    }),
    [article, community, innerId, thread],
  )

  return <ArticleQueryContext.Provider value={value}>{children}</ArticleQueryContext.Provider>
}
