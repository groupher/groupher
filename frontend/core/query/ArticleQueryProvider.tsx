'use client'

import { useQuery } from '@tanstack/react-query'
import { createContext, type ReactNode, useContext, useMemo } from 'react'

import useArticleState from '~/hooks/useArticleState'
import { articleRefKey } from '~/query/articleRef'
import type { TArticle, TArticleStats, TArticleViewerState, TThread } from '~/spec'

import { Q } from './client'

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
  const articleQuery = useQuery({
    ...Q.article.detail(community, thread, innerId),
    initialData: initialArticle || undefined,
  })
  const state = useArticleState(articleQuery.data)
  const value = useMemo(
    () => ({
      article: state?.article || null,
      stats: state?.stats || null,
      viewerState: state?.viewerState || {
        articleKey: articleRefKey({ community, thread, innerId }),
      },
      community,
      innerId: String(innerId),
      thread,
    }),
    [community, innerId, state, thread],
  )

  return <ArticleQueryContext.Provider value={value}>{children}</ArticleQueryContext.Provider>
}
