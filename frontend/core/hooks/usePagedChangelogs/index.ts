import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import TYPE from '~/const/type'
import { EMPTY_PAGED_ARTICLES } from '~/const/utils'
import { getPagedArticlesParams } from '~/lib/pagedArticlesFilter'
import { useSearchParams } from '~/platform'
import { Q } from '~/query'
import type { TPagedChangelogs, TResState } from '~/spec'
import useAccount from '~/stores/account/hooks'
import useCommunity from '~/stores/community/hooks'

type TRes = {
  resState: TResState
  pagedChangelogs: TPagedChangelogs
  pagedParams: ReturnType<typeof getPagedArticlesParams>
}

/** Reads changelog server state directly from the canonical Query cache. */
export default function usePagedChangelogs(): TRes {
  const account = useAccount()
  const { slug } = useCommunity()
  const searchParams = useSearchParams()
  const pagedParams = getPagedArticlesParams(slug, searchParams)
  const query = useQuery(Q.article.changelogs(pagedParams))
  const articleKeys = useMemo(
    () =>
      (query.data?.entries || []).map(
        (article) => `${article.community.slug}:${article.meta.thread}:${article.innerId}`,
      ),
    [query.data?.entries],
  )
  const viewerQuery = useQuery(
    Q.viewer.changelogStates(account.user?.login || '', pagedParams, articleKeys),
  )
  const pagedChangelogs = useMemo(() => {
    if (!query.data || !viewerQuery.data) return query.data || EMPTY_PAGED_ARTICLES
    return {
      ...query.data,
      entries: query.data.entries.map((article) => {
        const key = `${article.community.slug}:${article.meta.thread}:${article.innerId}`
        const viewerState = viewerQuery.data[key]
        return viewerState ? { ...article, ...viewerState, articleKey: undefined } : article
      }),
    }
  }, [query.data, viewerQuery.data])
  return {
    resState: (query.isPending ? TYPE.RES_STATE.LOADING : TYPE.RES_STATE.DONE) as TResState,
    pagedChangelogs: pagedChangelogs as TPagedChangelogs,
    pagedParams,
  }
}
