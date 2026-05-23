'use client'

import { useEffect } from 'react'

import useGraphQLClient from '~/hooks/useGraphQLClient'
import type { TPagedArticles } from '~/spec'
import useArticleList from '~/stores/articleList/hooks'
import ArticleListStoreProvider from '~/stores/articleList/provider'
import useCommunity from '~/stores/community/hooks'
import KanbanThread from '~/unit/KanbanThread'
import S from '~/unit/KanbanThread/schema'

type TGroupedKanbanPosts = {
  backlog: TPagedArticles
  todo: TPagedArticles
  wip: TPagedArticles
  done: TPagedArticles
  rejected: TPagedArticles
}

type TGroupedKanbanPostsRes = {
  groupedKanbanPosts: TGroupedKanbanPosts
}

function KanbanContent() {
  const articleList$ = useArticleList()
  const { slug: community } = useCommunity()
  const { query } = useGraphQLClient()

  useEffect(() => {
    let canceled = false

    query<TGroupedKanbanPostsRes>(S.groupedKanbanPosts, { community })
      .then((data) => {
        if (canceled) return
        articleList$.commit(data.groupedKanbanPosts)
      })
      .catch(() => {
        // Keep the board shell visible when local dashboard data is unavailable.
      })

    return () => {
      canceled = true
    }
  }, [articleList$, community, query])

  return <KanbanThread />
}

export default function Kanban() {
  return (
    <ArticleListStoreProvider>
      <KanbanContent />
    </ArticleListStoreProvider>
  )
}
