import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'

import { THREAD } from '~/const/thread'
import TYPE from '~/const/type'
import useURLSearchParams from '~/hooks/useURLSearchParams'
import { getPagedArticlesParams } from '~/lib/pagedArticlesFilter'
import { Q } from '~/query'
import { isArticleStatsSnapshotStale } from '~/query/articleStats'
import { invalidate, QueryInvalidation } from '~/query/invalidation'
import { overlayArticleUpvoteReceiptOnViewerState } from '~/query/mutation/articleReceipt'
import useArticleInteractionReconcile from '~/query/useArticleInteractionReconcile'
import { clearArticleViewReceipt, readArticleViewReceipt } from '~/query/viewReceipt'
import type { TPagedArticleViewModels, TResState, TArticleViewerState } from '~/spec'
import { getAccountRef } from '~/stores/account/accountRef'
import useAccount from '~/stores/account/hooks'
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
  const account = useAccount()
  const queryClient = useQueryClient()
  const refreshedStats = useRef(false)
  const { slug } = useCommunity()
  const searchParams = useURLSearchParams()
  const pagedParams = getPagedArticlesParams(slug, searchParams)
  const query = useQuery(Q.article.posts(pagedParams))
  const statsQuery = useQuery(
    Q.article.statsBatch(
      slug,
      THREAD.POST,
      (query.data?.entries || []).map((article) => article.innerId),
    ),
  )
  const statsEntities = useQueries({
    queries: (query.data?.entries || []).map((article) => ({
      ...Q.article.stats(slug, THREAD.POST, article.innerId),
      enabled: false,
    })),
  })
  useEffect(() => {
    if (
      refreshedStats.current ||
      !statsQuery.data?.some((stat) => isArticleStatsSnapshotStale(stat.snapshotAt))
    )
      return
    refreshedStats.current = true
    void invalidate(queryClient, QueryInvalidation.article.statsBatch(slug, THREAD.POST))
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
  const pagedPosts = useMemo(() => {
    if (!query.data) return EMPTY_POST_VIEW_MODELS
    const accountRef = account.accountRef || getAccountRef(account.user)

    const stats = new Map<string, NonNullable<typeof statsQuery.data>[number]>()
    for (const stat of statsQuery.data || []) stats.set(String(stat.innerId), stat)
    for (const query of statsEntities) {
      if (query.data) stats.set(String(query.data.innerId), query.data)
    }

    return {
      ...query.data,
      entries: query.data.entries.map((article) => {
        const key = `${article.community.slug}:${article.meta.thread}:${article.innerId}`
        const baseViewerState: TArticleViewerState = {
          articleKey: key,
          ...viewerQuery.data?.[key],
        }
        const stat = stats.get(String(article.innerId))
        const viewed = readArticleViewReceipt(key)
          ? { ...baseViewerState, viewerHasViewed: true }
          : baseViewerState
        return {
          content: article,
          stats: stat || null,
          viewerState: overlayArticleUpvoteReceiptOnViewerState(accountRef, stat, viewed, key),
        }
      }),
    } as unknown as TPagedArticleViewModels
  }, [
    account.accountRef,
    account.user,
    query.data,
    statsEntities,
    statsQuery.data,
    viewerQuery.data,
  ])
  const resState = (query.isPending ? TYPE.RES_STATE.LOADING : TYPE.RES_STATE.DONE) as TResState

  return {
    resState,
    pagedPosts,
    pagedParams,
  }
}
