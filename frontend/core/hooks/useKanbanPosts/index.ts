import { useQuery } from '@tanstack/react-query'

import TYPE from '~/const/type'
import { EMPTY_PAGED_ARTICLES } from '~/const/utils'
import { Q } from '~/query'
import type { TPagedPosts, TResState } from '~/spec'
import useCommunity from '~/stores/community/hooks'

type TRes = {
  backlog: TPagedPosts
  todo: TPagedPosts
  wip: TPagedPosts
  done: TPagedPosts
  rejected: TPagedPosts
  resState: TResState
}

/** Reads grouped kanban server state directly from Query. */
export default function useKanbanPosts(): TRes {
  const { slug } = useCommunity()
  const query = useQuery(Q.article.kanban(slug))
  const data = query.data

  return {
    resState: (!data && query.isFetching
      ? TYPE.RES_STATE.LOADING
      : TYPE.RES_STATE.DONE) as TResState,
    backlog: data?.backlog || EMPTY_PAGED_ARTICLES,
    todo: data?.todo || EMPTY_PAGED_ARTICLES,
    wip: data?.wip || EMPTY_PAGED_ARTICLES,
    done: data?.done || EMPTY_PAGED_ARTICLES,
    rejected: data?.rejected || EMPTY_PAGED_ARTICLES,
  }
}
