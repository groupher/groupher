/**
 * Adapts route-owned Article content into the normalized Core Article context.
 *
 *   route locator
 *     -> Article content query
 *     -> useArticleState (stats + private owners)
 *     -> ArticleQueryContext consumers
 *
 * The provider does not create a second cache or hydrate viewer fields into public content.
 */
'use client'

import { useQuery } from '@tanstack/react-query'
import { createContext, type ReactNode, useContext, useMemo } from 'react'

import useArticleState from '~/hooks/useArticleState'
import { articlePathKey } from '~/query/articlePath'
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

/** Returns the composed Article context supplied by the nearest route query boundary. */
export const useArticleQueryContext = (): TValue | null => useContext(ArticleQueryContext)

/** Provides route content plus independently loaded stats/private state to Article descendants. */
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
      article: state?.content || null,
      stats: state?.stats || null,
      viewerState: state?.viewerState || {
        articleKey: articlePathKey({ community, thread, innerId }),
      },
      community,
      innerId: String(innerId),
      thread,
    }),
    [community, innerId, state, thread],
  )

  return <ArticleQueryContext.Provider value={value}>{children}</ArticleQueryContext.Provider>
}
