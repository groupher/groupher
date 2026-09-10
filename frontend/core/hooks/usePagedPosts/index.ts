import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

import TYPE from '~/const/type'
import { EMPTY_PAGED_ARTICLES } from '~/const/utils'
import useURLSearchParams from '~/hooks/useURLSearchParams'
import { getPagedArticlesParams } from '~/lib/pagedArticlesFilter'
import { Q } from '~/query'
import { overlayArticleUpvoteReceiptIfNewer } from '~/query/mutation/articleReceipt'
import useArticleInteractionReconcile from '~/query/useArticleInteractionReconcile'
import { clearArticleViewReceipt, readArticleViewReceipt } from '~/query/viewReceipt'
import type { TPagedPosts, TResState } from '~/spec'
import { getAccountRef } from '~/stores/account/accountRef'
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
    if (!query.data) return EMPTY_PAGED_ARTICLES
    const accountRef = account.accountRef || getAccountRef(account.user)

    return {
      ...query.data,
      entries: query.data.entries.map((article) => {
        const key = `${article.community.slug}:${article.meta.thread}:${article.innerId}`
        const viewerState = viewerQuery.data?.[key]
        const merged = viewerState ? { ...article, ...viewerState, articleKey: undefined } : article
        const viewed =
          accountRef && readArticleViewReceipt(key) ? { ...merged, viewerHasViewed: true } : merged
        return overlayArticleUpvoteReceiptIfNewer(accountRef, viewed, key) || viewed
      }),
    } as TPagedPosts
  }, [account.accountRef, account.user, query.data, viewerQuery.data])
  const resState = (query.isPending ? TYPE.RES_STATE.LOADING : TYPE.RES_STATE.DONE) as TResState

  return {
    resState,
    pagedPosts,
    pagedParams,
  }
}
