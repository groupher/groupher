import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import TYPE from '~/const/type'
import useArticleStates from '~/hooks/useArticleStates'
import useURLSearchParams from '~/hooks/useURLSearchParams'
import { getPagedArticlesParams } from '~/lib/pagedArticlesFilter'
import { Q } from '~/query'
import type { TChangelog, TPagedArticleViewModels, TResState } from '~/spec'
import useCommunity from '~/stores/community/hooks'

type TRes = {
  resState: TResState
  pagedChangelogs: TPagedArticleViewModels<TChangelog>
  pagedParams: ReturnType<typeof getPagedArticlesParams>
}

const EMPTY_CHANGELOG_VIEW_MODELS: TPagedArticleViewModels<TChangelog> = { entries: [] }

/** Reads changelog server state directly from the canonical Query cache. */
export default function usePagedChangelogs(): TRes {
  const { slug } = useCommunity()
  const searchParams = useURLSearchParams()
  const pagedParams = getPagedArticlesParams(slug, searchParams)
  const query = useQuery(Q.article.changelogs(pagedParams))
  const states = useArticleStates(query.data?.entries)
  const pagedChangelogs = useMemo(() => {
    if (!query.data) return EMPTY_CHANGELOG_VIEW_MODELS

    return {
      ...query.data,
      entries: states.map(({ content, stats, viewerState }) => ({
        content,
        stats,
        viewerState,
      })),
    } as TPagedArticleViewModels<TChangelog>
  }, [query.data, states])
  return {
    resState: (query.isPending ? TYPE.RES_STATE.LOADING : TYPE.RES_STATE.DONE) as TResState,
    pagedChangelogs,
    pagedParams,
  }
}
