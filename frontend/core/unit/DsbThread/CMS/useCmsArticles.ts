import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { THREAD } from '~/const/thread'
import { EMPTY_PAGED_ARTICLES } from '~/const/utils'
import { Q } from '~/query'
import type { TPagedArticles } from '~/spec'
import useCommunity from '~/stores/community/hooks'

type TArticleKind = 'changelog' | 'post'

/** Exposes cms articles state and actions through the shared React hook boundary. */
export default function useCmsArticles(kind: TArticleKind) {
  const { slug: community } = useCommunity()
  const filter = { page: 1, size: 20, community }
  const postsQuery = useQuery({ ...Q.article.posts(filter), enabled: kind === 'post' })
  const changelogsQuery = useQuery({
    ...Q.article.changelogs(filter),
    enabled: kind === 'changelog',
  })
  const query = kind === 'post' ? postsQuery : changelogsQuery
  const thread = kind === 'post' ? THREAD.POST : THREAD.CHANGELOG
  const statsQuery = useQuery(
    Q.article.articleStatsBatch(
      community,
      thread,
      (query.data?.entries || []).map((article) => article.innerId),
    ),
  )
  const pagedArticles = useMemo(() => {
    const page = query.data || EMPTY_PAGED_ARTICLES
    const stats = new Map<string, NonNullable<typeof statsQuery.data>[number]>()

    for (const stat of statsQuery.data || []) stats.set(String(stat.innerId), stat)

    return {
      ...page,
      entries: page.entries.map((article) => {
        const stat = stats.get(String(article.innerId))
        return stat ? { ...article, articleStats: stat } : article
      }),
    }
  }, [query.data, statsQuery.data])

  return {
    loading: (!query.data || statsQuery.isFetching) && query.isFetching,
    pagedArticles: pagedArticles as TPagedArticles,
  }
}
