import { useCallback } from 'react'

import { EMPTY_PAGED_ARTICLES } from '~/const/utils'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import type { TPagedArticles } from '~/spec'
import useArticleList from '~/stores/articleList/hooks'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'
import S from '~/unit/DashboardThread/schema'

type TArticleKind = 'changelog' | 'post'

const config = {
  changelog: {
    field: 'pagedChangelogs',
    query: S.pagedChangelogs,
  },
  post: {
    field: 'pagedPosts',
    query: S.pagedPosts,
  },
} as const

export default function useCmsArticles(kind: TArticleKind) {
  const articleList$ = useArticleList()
  const community$ = useCommunity()
  const dsb$ = useDashboard()
  const { query } = useGraphQLClient()
  const entry = config[kind]
  const pagedArticles = articleList$[entry.field] || EMPTY_PAGED_ARTICLES

  const loadArticles = useCallback(() => {
    dsb$.commit({ loading: true })

    query<Record<typeof entry.field, TPagedArticles>>(entry.query, {
      filter: { page: 1, size: 20, community: community$.slug },
      userHasLogin: false,
    })
      .then((data) => articleList$.commit({ [entry.field]: data[entry.field] }))
      .finally(() => dsb$.commit({ loading: false }))
  }, [articleList$, community$.slug, dsb$, entry, query])

  return {
    loadArticles,
    loading: dsb$.loading,
    pagedArticles,
  }
}
