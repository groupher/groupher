import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { THREAD } from '~/const/thread'
import TYPE from '~/const/type'
import usePagiConfig from '~/hooks/usePagiConfig'
import { toPagiGraphQLInput } from '~/lib/pagination/params'
import { Q } from '~/query'
import { splitTicketSourceStatsIds } from '~/query/ticketStats'
import type {
  TGraphQLPagiPageInfo,
  TPagedTickets,
  TPagiRequest,
  TPaginationMode,
  TResState,
  TTicket,
  TTicketFilter,
  TTicketStats,
  TTicketStatus,
  TTicketViewModel,
} from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDsbConfig from '~/stores/dsbConfig/hooks'

const boards = ['todo', 'wip', 'done'] as const
type Board = (typeof boards)[number]
type TKanbanPageData = TPagedTickets & { pageInfo: TGraphQLPagiPageInfo }

export type TKanbanPage = {
  entries: readonly TTicketViewModel[]
  pageInfo?: TGraphQLPagiPageInfo
  mode: TPaginationMode
  setPage: (page: number) => void
  next: () => void
  retry: () => void
  pending: boolean
  error: unknown
}

type TRes = Record<Board, TKanbanPage> & { resState: TResState }

/** Reads the dedicated public or internal Ticket board and batches linked Post stats. */
export default function useKanbanTickets(internal = false, filter: TTicketFilter = {}): TRes {
  const { slug } = useCommunity()
  const queryClient = useQueryClient()
  const { config, ready } = usePagiConfig(useDsbConfig(), slug)
  const initialPagi = toPagiGraphQLInput({
    api: 'offset',
    page: 1,
    size: config.defaultSize,
    configRevision: config.revision,
  })
  const query = useQuery({
    ...Q.ticket.kanban(slug, initialPagi, internal, filter),
    enabled: ready && !!slug,
  })
  const scope = `${slug}:${config.revision}:${internal ? 'internal' : 'public'}:${JSON.stringify(filter)}`
  const [positions, setPositions] = useState<{
    scope: string
    requests: Partial<Record<Board, TPagiRequest[]>>
  }>({ scope, requests: {} })
  const requests = positions.scope === scope ? positions.requests : {}
  const setPosition = (board: Board, request: TPagiRequest) =>
    setPositions((current) => {
      const existing = current.scope === scope ? current.requests : {}
      const prior = existing[board] || []
      if (
        config.mode !== 'page' &&
        request.api === 'offset' &&
        prior.some((item) => item.api === 'offset' && item.page === request.page)
      )
        return current
      return {
        scope,
        requests: {
          ...existing,
          [board]: config.mode === 'page' ? [request] : [...prior, request],
        },
      }
    })
  const pageRequests = boards.flatMap((board) =>
    (requests[board] || []).map((request) => ({ board, request })),
  )
  const pages = useQueries({
    queries: pageRequests.map(({ board, request }) =>
      Q.ticket.page(
        slug,
        board.toUpperCase() as TTicketStatus,
        toPagiGraphQLInput(request),
        internal,
        filter,
      ),
    ),
  })

  const boardPages: Partial<Record<Board, TKanbanPageData>> = {}
  const allTickets: TTicket[] = []
  for (const board of boards) {
    const indices = pageRequests.flatMap((item, index) => (item.board === board ? [index] : []))
    const head = query.data?.[board] as TKanbanPageData | undefined
    const loaded = indices.flatMap((index) => (pages[index].data ? [pages[index].data!] : []))
    const selectedPages = requests[board]?.length
      ? config.mode === 'page'
        ? loaded.slice(-1)
        : [...(head ? [head] : []), ...loaded]
      : head
        ? [head]
        : []
    const seen = new Set<string>()
    const entries = selectedPages
      .flatMap((page) => page.entries)
      .filter((ticket) => {
        if (seen.has(ticket.id)) return false
        seen.add(ticket.id)
        return true
      })
    const last = selectedPages.at(-1)
    if (last) {
      boardPages[board] = { ...last, entries }
      allTickets.push(...entries)
    }
  }

  const postIds = useMemo(
    () =>
      Array.from(
        new Set(
          allTickets
            .flatMap((ticket) => ticket.sources.map((source) => source.innerId))
            .filter((innerId): innerId is number => innerId !== null)
            .map(String),
        ),
      ).sort(),
    [allTickets],
  )
  const statsChunks = splitTicketSourceStatsIds(postIds.map(Number))
  const statsQueries = useQueries({
    queries: statsChunks.map((innerIds) =>
      Q.article.statsBatch(queryClient, slug, THREAD.POST, innerIds),
    ),
  })
  const statsByInnerId = useMemo(() => {
    const result = new Map<string, { upvotesCount: number; commentsCount: number; views: number }>()
    for (const statsQuery of statsQueries) {
      for (const stats of statsQuery.data || []) {
        result.set(String(stats.innerId), {
          upvotesCount: stats.upvotesCount,
          commentsCount: stats.commentsCount,
          views: stats.views,
        })
      }
    }
    return result
  }, [statsQueries])

  const toViewModels = (board: Board): TKanbanPage => {
    const page = boardPages[board]
    const index = pageRequests.map((item) => item.board).lastIndexOf(board)
    const active = index < 0 ? undefined : pages[index]
    const entries = (page?.entries || []).map((ticket) => {
      const stats: TTicketStats = ticket.sources.reduce(
        (total, post) => {
          const linked = post.innerId ? statsByInnerId.get(String(post.innerId)) : undefined
          if (!linked) return total
          return {
            upvotesCount: total.upvotesCount + linked.upvotesCount,
            commentsCount: total.commentsCount + linked.commentsCount,
            views: total.views + linked.views,
          }
        },
        { upvotesCount: 0, commentsCount: 0, views: 0 },
      )
      return { content: ticket, stats }
    })

    return {
      pageInfo: page?.pageInfo,
      entries,
      setPage: (selectedPage) =>
        setPosition(board, {
          api: 'offset',
          page: selectedPage,
          size: config.defaultSize,
          configRevision: config.revision,
        }),
      next: () => {
        const info = page?.pageInfo
        if (info?.__typename === 'OffsetPageInfo' && info.hasNextPage)
          setPosition(board, {
            api: 'offset',
            page: info.page + 1,
            size: info.size,
            configRevision: config.revision,
          })
      },
      retry: () => void (active ? active.refetch() : query.refetch()),
      mode: config.mode,
      pending: active ? active.isFetching : query.isFetching,
      error: active ? active.error : query.error,
    }
  }

  return {
    resState: (!query.data && query.isFetching
      ? TYPE.RES_STATE.LOADING
      : TYPE.RES_STATE.DONE) as TResState,
    todo: toViewModels('todo'),
    wip: toViewModels('wip'),
    done: toViewModels('done'),
  }
}
