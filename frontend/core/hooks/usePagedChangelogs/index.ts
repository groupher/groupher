import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'

import { THREAD } from '~/const/thread'
import TYPE from '~/const/type'
import { EMPTY_PAGED_ARTICLES } from '~/const/utils'
import useURLSearchParams from '~/hooks/useURLSearchParams'
import { getPagedArticlesParams } from '~/lib/pagedArticlesFilter'
import { Q } from '~/query'
import { isArticleStatsSnapshotStale } from '~/query/articleStats'
import { overlayArticleUpvoteReceiptIfNewer } from '~/query/mutation/articleReceipt'
import useArticleInteractionReconcile from '~/query/useArticleInteractionReconcile'
import { clearArticleViewReceipt, readArticleViewReceipt } from '~/query/viewReceipt'
import type { TPagedChangelogs, TResState } from '~/spec'
import { getAccountRef } from '~/stores/account/accountRef'
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
  const queryClient = useQueryClient()
  const refreshedStats = useRef(false)
  const { slug } = useCommunity()
  const searchParams = useURLSearchParams()
  const pagedParams = getPagedArticlesParams(slug, searchParams)
  const query = useQuery(Q.article.changelogs(pagedParams))
  const statsQuery = useQuery(
    Q.article.articleStatsBatch(
      slug,
      THREAD.CHANGELOG,
      (query.data?.entries || []).map((article) => article.innerId),
    ),
  )
  useEffect(() => {
    if (
      refreshedStats.current ||
      !statsQuery.data?.some((stat) => isArticleStatsSnapshotStale(stat.snapshotAt))
    )
      return
    refreshedStats.current = true
    void queryClient.invalidateQueries({
      queryKey: Q.article.articleStatsBatch(slug, THREAD.CHANGELOG, []).queryKey.slice(0, 4),
    })
  }, [queryClient, slug, statsQuery.data])
  const articleRefs = useMemo(
    () =>
      (query.data?.entries || []).map((article) => ({
        community: article.community.slug,
        thread: article.meta.thread,
        innerId: article.innerId,
      })),
    [query.data?.entries],
  )
  const viewerQuery = useQuery(
    Q.viewer.articleStates(account.accountRef || getAccountRef(account.user) || '', articleRefs),
  )
  useEffect(() => {
    for (const key of Object.keys(viewerQuery.data || {})) {
      if (viewerQuery.data?.[key]?.viewerHasViewed === true) clearArticleViewReceipt(key)
    }
  }, [viewerQuery.data])
  useArticleInteractionReconcile(query.data?.entries)
  const pagedChangelogs = useMemo(() => {
    if (!query.data) return EMPTY_PAGED_ARTICLES
    const accountRef = account.accountRef || getAccountRef(account.user)
    const stats = new Map<string, NonNullable<typeof statsQuery.data>[number]>()
    for (const stat of statsQuery.data || []) stats.set(String(stat.innerId), stat)

    return {
      ...query.data,
      entries: query.data.entries.map((article) => {
        const key = `${article.community.slug}:${article.meta.thread}:${article.innerId}`
        const viewerState = viewerQuery.data?.[key]
        const stat = stats.get(String(article.innerId))
        const withStats = stat ? { ...article, articleStats: stat } : article
        const merged = viewerState
          ? { ...withStats, ...viewerState, articleKey: undefined }
          : withStats
        const viewed = readArticleViewReceipt(key) ? { ...merged, viewerHasViewed: true } : merged
        return overlayArticleUpvoteReceiptIfNewer(accountRef, viewed, key) || viewed
      }),
    }
  }, [account.accountRef, account.user, query.data, statsQuery.data, viewerQuery.data])
  return {
    resState: (query.isPending ? TYPE.RES_STATE.LOADING : TYPE.RES_STATE.DONE) as TResState,
    pagedChangelogs: pagedChangelogs as TPagedChangelogs,
    pagedParams,
  }
}
