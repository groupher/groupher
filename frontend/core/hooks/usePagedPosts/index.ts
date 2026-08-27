import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import TYPE from '~/const/type'
import { EMPTY_PAGED_ARTICLES } from '~/const/utils'
import useURLSearchParams from '~/hooks/useURLSearchParams'
import { getPagedArticlesParams } from '~/lib/pagedArticlesFilter'
import { Q } from '~/query'
import type { TPagedPosts, TResState } from '~/spec'
import useAccount from '~/stores/account/hooks'
import useCommunity from '~/stores/community/hooks'

type TRes = {
  resState: TResState
  pagedPosts: TPagedPosts
  pagedParams: ReturnType<typeof getPagedArticlesParams>
}

/**
 * Reads and updates the current community post-list state.
 *
 * The hook keeps URL-derived filters next to the articleList store data so list
 * pages, tag bars, and refresh actions all talk through the same paging shape.
 */
export default function usePagedPosts(): TRes {
  const account = useAccount()
  const { slug } = useCommunity()
  const searchParams = useURLSearchParams()
  const pagedParams = getPagedArticlesParams(slug, searchParams)
  const query = useQuery(Q.article.posts(pagedParams))
  const articleKeys = useMemo(
    () =>
      (query.data?.entries || []).map(
        (article) => `${article.community.slug}:${article.meta.thread}:${article.innerId}`,
      ),
    [query.data?.entries],
  )
  const viewerScope = account.user?.login || ''
  const viewerQuery = useQuery(Q.viewer.articleStates(viewerScope, pagedParams, articleKeys))
  const pagedPosts = useMemo(() => {
    if (!query.data || !viewerQuery.data) return query.data || EMPTY_PAGED_ARTICLES

    return {
      ...query.data,
      entries: query.data.entries.map((article) => {
        const key = `${article.community.slug}:${article.meta.thread}:${article.innerId}`
        const viewerState = viewerQuery.data[key]
        return viewerState ? { ...article, ...viewerState, articleKey: undefined } : article
      }),
    } as TPagedPosts
  }, [query.data, viewerQuery.data])
  const resState = (query.isPending ? TYPE.RES_STATE.LOADING : TYPE.RES_STATE.DONE) as TResState

  return {
    resState,
    pagedPosts,
    pagedParams,
  }
}
