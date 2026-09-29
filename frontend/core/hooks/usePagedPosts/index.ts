import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import TYPE from '~/const/type'
import useArticleStates from '~/hooks/useArticleStates'
import useURLSearchParams from '~/hooks/useURLSearchParams'
import { getPagedArticlesParams } from '~/lib/pagedArticlesFilter'
import { Q } from '~/query'
import type { TPagedArticleViewModels, TResState } from '~/spec'
import useCommunity from '~/stores/community/hooks'

type TRes = {
  resState: TResState
  pagedPosts: TPagedArticleViewModels
  pagedParams: ReturnType<typeof getPagedArticlesParams>
}

const EMPTY_POST_VIEW_MODELS: TPagedArticleViewModels = { entries: [] }

/**
 * Reads and updates the current community post-list state.
 *
 * The hook keeps URL-derived filters next to the articleList store data so list
 * pages, tag bars, and refresh actions all talk through the same paging shape.
 */
export default function usePagedPosts(): TRes {
  const { slug } = useCommunity()
  const searchParams = useURLSearchParams()
  const pagedParams = getPagedArticlesParams(slug, searchParams)
  const query = useQuery(Q.article.posts(pagedParams))
  const states = useArticleStates(query.data?.entries)
  const pagedPosts = useMemo(() => {
    if (!query.data) return EMPTY_POST_VIEW_MODELS

    return {
      ...query.data,
      entries: states.map(({ content, stats, viewerState }) => ({
        content,
        stats,
        viewerState,
      })),
    } as TPagedArticleViewModels
  }, [query.data, states])
  const resState = (query.isPending ? TYPE.RES_STATE.LOADING : TYPE.RES_STATE.DONE) as TResState

  return {
    resState,
    pagedPosts,
    pagedParams,
  }
}
