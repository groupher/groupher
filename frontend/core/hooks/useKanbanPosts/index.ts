import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import TYPE from '~/const/type'
import { EMPTY_PAGED_ARTICLES } from '~/const/utils'
import useArticleStates from '~/hooks/useArticleStates'
import { Q } from '~/query'
import type { TPagedArticleViewModels, TPagedPosts, TResState } from '~/spec'
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
  const query = useQuery(Q.article.kanban(slug))
  const data = query.data
  const entries = useMemo(
    () => Object.values(data || {}).flatMap((page) => page.entries || []),
    [data],
  )
  const states = useArticleStates(entries)
  const stateByArticle = useMemo(
    () => new Map(states.map((state) => [state.content, state] as const)),
    [states],
  )

  const toViewModels = (page: TPagedPosts | undefined): TPagedArticleViewModels => {
    return {
      ...(page || EMPTY_PAGED_ARTICLES),
      entries: (page?.entries || []).map((article) => {
        const state = stateByArticle.get(article)!
        return {
          content: article,
          stats: state.stats,
          viewerState: state.viewerState,
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
