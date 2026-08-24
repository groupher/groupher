import { useQuery } from '@tanstack/react-query'

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

  return {
    loading: !query.data && query.isFetching,
    pagedArticles: (query.data || EMPTY_PAGED_ARTICLES) as TPagedArticles,
  }
}
