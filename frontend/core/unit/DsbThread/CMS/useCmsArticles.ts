import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

import { THREAD } from '~/const/thread'
import { EMPTY_PAGED_ARTICLES } from '~/const/utils'
import { Q } from '~/query'
import { articlePathKey } from '~/query/articlePath'
import type { TPagedArticleViewModels, TArticleViewerState } from '~/spec'
import useCommunity from '~/stores/community/hooks'

type TArticleKind = 'changelog' | 'post'

/** Exposes cms articles state and actions through the shared React hook boundary. */
export default function useCmsArticles(kind: TArticleKind) {
  const queryClient = useQueryClient()
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
    Q.article.statsBatch(
      queryClient,
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
        const articleKey = articlePathKey({ community, thread, innerId: String(article.innerId) })
        const viewerState: TArticleViewerState = { articleKey }
        return { content: article, stats: stat || null, viewerState }
      }),
    }
  }, [community, query.data, statsQuery.data, thread])

  return {
    loading: (!query.data || statsQuery.isFetching) && query.isFetching,
    pagedArticles: pagedArticles as TPagedArticleViewModels,
  }
}
