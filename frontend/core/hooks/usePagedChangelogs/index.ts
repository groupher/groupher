import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

import { THREAD } from '~/const/thread'
import TYPE from '~/const/type'
import { EMPTY_PAGED_ARTICLES } from '~/const/utils'
import useURLSearchParams from '~/hooks/useURLSearchParams'
import { getPagedArticlesParams } from '~/lib/pagedArticlesFilter'
import { Q } from '~/query'
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
  const { slug } = useCommunity()
  const searchParams = useURLSearchParams()
  const pagedParams = getPagedArticlesParams(slug, searchParams)
  const query = useQuery(Q.article.changelogs(pagedParams))
  const summaryQuery = useQuery(
    Q.article.viewSummaries(
      slug,
      THREAD.CHANGELOG,
      (query.data?.entries || []).map((article) => article.innerId),
    ),
  )
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
    const summaries = new Map<string, (typeof summaryQuery.data)[number]>()
    for (const summary of summaryQuery.data || []) summaries.set(String(summary.innerId), summary)

    return {
      ...query.data,
      entries: query.data.entries.map((article) => {
        const key = `${article.community.slug}:${article.meta.thread}:${article.innerId}`
        const viewerState = viewerQuery.data?.[key]
        const summary = summaries.get(String(article.innerId))
        const withSummary = summary
          ? { ...article, views: summary.views, viewsRevision: summary.revision }
          : article
        const merged = viewerState
          ? { ...withSummary, ...viewerState, articleKey: undefined }
          : withSummary
        const viewed = readArticleViewReceipt(key) ? { ...merged, viewerHasViewed: true } : merged
        return overlayArticleUpvoteReceiptIfNewer(accountRef, viewed, key) || viewed
      }),
    }
  }, [account.accountRef, account.user, query.data, summaryQuery.data, viewerQuery.data])
  return {
    resState: (query.isPending ? TYPE.RES_STATE.LOADING : TYPE.RES_STATE.DONE) as TResState,
    pagedChangelogs: pagedChangelogs as TPagedChangelogs,
    pagedParams,
  }
}
