import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { THREAD } from '~/const/thread'
import TYPE from '~/const/type'
import { EMPTY_PAGED_ARTICLES } from '~/const/utils'
import { Q } from '~/query'
import { overlayArticleUpvoteReceiptOnViewerState } from '~/query/mutation/articleReceipt'
import type { TPagedArticleViewModels, TPagedPosts, TArticleViewerState, TResState } from '~/spec'
import { getAccountRef } from '~/stores/account/accountRef'
import useAccount from '~/stores/account/hooks'
import useCommunity from '~/stores/community/hooks'

type TRes = {
  backlog: TPagedArticleViewModels
  todo: TPagedArticleViewModels
  wip: TPagedArticleViewModels
  done: TPagedArticleViewModels
  rejected: TPagedArticleViewModels
  resState: TResState
}

/** Reads grouped kanban server state directly from Query. */
export default function useKanbanPosts(): TRes {
  const { slug } = useCommunity()
  const account = useAccount()
  const query = useQuery(Q.article.kanban(slug))
  const data = query.data
  const entries = useMemo(
    () => Object.values(data || {}).flatMap((page) => page.entries || []),
    [data],
  )
  const statsQuery = useQuery(
    Q.article.statsBatch(
      slug,
      THREAD.POST,
      entries.map((article) => article.innerId),
    ),
  )
  const refs = useMemo(
    () =>
      entries.map((article) => ({
        community: article.community.slug,
        thread: article.meta.thread,
        innerId: article.innerId,
      })),
    [entries],
  )
  const viewerQuery = useQuery(
    Q.viewer.articleStates(account.accountRef || getAccountRef(account.user) || '', refs),
  )

  const toViewModels = (page: TPagedPosts | undefined): TPagedArticleViewModels => {
    const stats = new Map<string, NonNullable<typeof statsQuery.data>[number]>()
    for (const stat of statsQuery.data || []) stats.set(String(stat.innerId), stat)
    return {
      ...(page || EMPTY_PAGED_ARTICLES),
      entries: (page?.entries || []).map((article) => {
        const key = `${article.community.slug}:${article.meta.thread}:${article.innerId}`
        const stat = stats.get(String(article.innerId)) || null
        const viewerState: TArticleViewerState = {
          articleKey: key,
          ...viewerQuery.data?.[key],
        }
        return {
          content: article,
          stats: stat,
          viewerState: overlayArticleUpvoteReceiptOnViewerState(
            account.accountRef || getAccountRef(account.user),
            stat,
            viewerState,
            key,
          ),
        }
      }),
    }
  }

  return {
    resState: (!data && query.isFetching
      ? TYPE.RES_STATE.LOADING
      : TYPE.RES_STATE.DONE) as TResState,
    backlog: toViewModels(data?.backlog),
    todo: toViewModels(data?.todo),
    wip: toViewModels(data?.wip),
    done: toViewModels(data?.done),
    rejected: toViewModels(data?.rejected),
  }
}
