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
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react'

import useArticleState from '~/hooks/useArticleState'
import { articlePathKey } from '~/query/articlePath'
import type { MentionsGraphFocus } from '~/query/mentionsGraph'
import type { TArticle, TArticleStats, TArticleViewerState, TThread } from '~/spec'

import { Q } from './client'

type TValue = {
  article: TArticle | null
  stats: TArticleStats | null
  viewerState: TArticleViewerState
  community: string
  innerId: string
  thread: TThread
  mentionsFocus: MentionsGraphFocus
  footerTab: 'activities' | 'members' | 'mentions'
  showMentions: (focus: MentionsGraphFocus) => void
  setFooterTab: (tab: 'activities' | 'members' | 'mentions') => void
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
  const articleKey = articlePathKey({ community, thread, innerId })
  const articleFocus: MentionsGraphFocus = {
    type: thread as MentionsGraphFocus['type'],
    articleInnerId: String(innerId),
  }
  const [footerState, setFooterState] = useState<{
    articleKey: string
    tab: TValue['footerTab']
    focus: MentionsGraphFocus
  }>(() => ({ articleKey, tab: 'activities', focus: articleFocus }))
  const currentFooterState =
    footerState.articleKey === articleKey
      ? footerState
      : { articleKey, tab: 'activities' as const, focus: articleFocus }
  const setFooterTab = useCallback(
    (tab: TValue['footerTab']) => {
      setFooterState((current) => {
        const base =
          current.articleKey === articleKey
            ? current
            : { articleKey, tab: 'activities' as const, focus: articleFocus }
        return { ...base, tab }
      })
    },
    [articleKey, articleFocus.articleInnerId, articleFocus.type],
  )
  const showMentions = useCallback(
    (focus: MentionsGraphFocus) => {
      setFooterState((current) => {
        const base =
          current.articleKey === articleKey
            ? current
            : { articleKey, tab: 'activities' as const, focus: articleFocus }
        return { ...base, tab: 'mentions', focus }
      })
      window.requestAnimationFrame(() => {
        document
          .getElementById('article-footer')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    },
    [articleKey, articleFocus.articleInnerId, articleFocus.type],
  )

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
      mentionsFocus: currentFooterState.focus,
      footerTab: currentFooterState.tab,
      showMentions,
      setFooterTab,
    }),
    [community, innerId, state, thread, currentFooterState, showMentions, setFooterTab],
  )

  return <ArticleQueryContext.Provider value={value}>{children}</ArticleQueryContext.Provider>
}
