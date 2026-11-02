import { queryOptions } from '@tanstack/react-query'

import { browserGraphQLRequest } from '~/graphql/client'
import { toPagiGraphQLInput } from '~/lib/pagination/params'
import {
  ticket as ticketDocument,
  ticketInternal,
  ticketKanban,
  ticketKanbanInternal,
  ticketPage,
  ticketPageInternal,
  postTicketLinksInternal,
  postTicketProgress,
  ticketSearch,
  ticketAssigneeCandidates,
  ticketTagGroups,
} from '~/schemas/pages/ticket'
import type { TPagiGraphQLInput, TPostTicketProgress, TTicketFilter, TTicketStatus } from '~/spec'

export const ticketQueryKeys = {
  all: ['ticket'] as const,
  kanban: (
    community: string,
    visibility: 'public' | 'internal',
    size: number,
    filter: TTicketFilter = {},
  ) => ['ticket', 'kanban', visibility, community, size, filter] as const,
  page: (
    community: string,
    status: TTicketStatus,
    pagi: TPagiGraphQLInput,
    visibility: 'public' | 'internal',
    filter: TTicketFilter,
  ) => ['ticket', 'page', visibility, community, status, pagi, filter] as const,
  detail: (community: string, innerId: string | number) =>
    ['ticket', 'detail', community, String(innerId)] as const,
  internalDetail: (community: string, id: string) =>
    ['ticket', 'internal-detail', community, id] as const,
  postLinksInternal: (community: string, postId: string) =>
    ['ticket', 'post-links-internal', community, postId] as const,
  postProgress: (community: string, postInnerIds: readonly number[]) =>
    ['ticket', 'post-progress', community, [...postInnerIds].sort((a, b) => a - b)] as const,
  search: (community: string, query: string, type: string) =>
    ['ticket', 'search', community, type, query.trim().toLowerCase()] as const,
}

const kanban = (
  community: string,
  pagi: TPagiGraphQLInput,
  internal = false,
  filter: TTicketFilter = {},
) =>
  queryOptions({
    queryKey: ticketQueryKeys.kanban(
      community,
      internal ? 'internal' : 'public',
      pagi.offset?.size || 20,
      filter,
    ),
    queryFn: async () => {
      if (internal) {
        const data = await browserGraphQLRequest(ticketKanbanInternal, { community, pagi, filter })
        return data.ticketKanbanInternal
      }
      const data = await browserGraphQLRequest(ticketKanban, { community, pagi })
      return data.ticketKanban
    },
    enabled: !!community,
    ...(internal ? {} : { meta: { hydration: 'public' as const } }),
  })

const page = (
  community: string,
  status: TTicketStatus,
  pagi: TPagiGraphQLInput,
  internal = false,
  filters: TTicketFilter = {},
) =>
  queryOptions({
    queryKey: ticketQueryKeys.page(
      community,
      status,
      pagi,
      internal ? 'internal' : 'public',
      filters,
    ),
    queryFn: async () => {
      if (internal) {
        const data = await browserGraphQLRequest(ticketPageInternal, {
          community,
          filter: { ...filters, status },
          pagi,
        })
        return data.ticketPageInternal
      }
      const data = await browserGraphQLRequest(ticketPage, { community, filter: { status }, pagi })
      return data.ticketPage
    },
    enabled: !!community,
    ...(internal ? {} : { meta: { hydration: 'public' as const } }),
  })

const detail = (community: string, innerId: string | number) =>
  queryOptions({
    queryKey: ticketQueryKeys.detail(community, innerId),
    queryFn: async () => {
      const data = await browserGraphQLRequest(ticketDocument, {
        community,
        innerId: Number(innerId),
      })
      return data.ticket
    },
    enabled: !!community && Number.isInteger(Number(innerId)) && Number(innerId) > 0,
    meta: { hydration: 'public' as const },
  })

const internalDetail = (community: string, id: string) =>
  queryOptions({
    queryKey: ticketQueryKeys.internalDetail(community, id),
    queryFn: async () => {
      const data = await browserGraphQLRequest(ticketInternal, { community, id })
      return data.ticketInternal
    },
    enabled: !!community && !!id,
  })

const postLinksInternal = (community: string, postId: string) =>
  queryOptions({
    queryKey: ticketQueryKeys.postLinksInternal(community, postId),
    queryFn: async () => {
      const data = await browserGraphQLRequest(postTicketLinksInternal, { community, postId })
      return data.postTicketLinksInternal
    },
    enabled: !!community && !!postId,
  })

const internalPage = (community: string, filter: TTicketFilter, pagi: TPagiGraphQLInput) =>
  queryOptions({
    queryKey: ['ticket', 'internal-page', community, filter, pagi] as const,
    queryFn: async () => {
      const data = await browserGraphQLRequest(ticketPageInternal, { community, filter, pagi })
      return data.ticketPageInternal
    },
    enabled: !!community,
  })

const postProgress = (community: string, postInnerIds: readonly number[]) => {
  const ids = [...new Set(postInnerIds.filter((id) => Number.isInteger(id) && id > 0))].sort(
    (a, b) => a - b,
  )
  return queryOptions({
    queryKey: ticketQueryKeys.postProgress(community, ids),
    queryFn: async () => {
      const data = await browserGraphQLRequest(postTicketProgress, {
        community,
        postInnerIds: ids,
      })
      return data.postTicketProgress as unknown as readonly TPostTicketProgress[]
    },
    enabled: !!community && ids.length > 0,
    meta: { hydration: 'public' as const },
  })
}

const searchInternal = (
  community: string,
  query: string,
  type: 'USER' | 'WORKER' | 'CASE' = 'USER',
) =>
  queryOptions({
    queryKey: ticketQueryKeys.search(community, query, type),
    queryFn: async () => {
      const data = await browserGraphQLRequest(ticketSearch, { community, query, type })
      return data.ticketSearch
    },
    enabled: !!community && query.trim().length > 0,
  })

const assigneeCandidates = (community: string) =>
  queryOptions({
    queryKey: ['ticket', 'assignee-candidates', community] as const,
    queryFn: async () => {
      const data = await browserGraphQLRequest(ticketAssigneeCandidates, {
        community,
        pagi: toPagiGraphQLInput({ api: 'offset', page: 1, size: 100 }),
      })
      return (data.pagedCommunityModerators?.entries || []).map(({ userId, user }) => ({
        id: String(userId),
        login: user.login,
        nickname: user.nickname,
      }))
    },
    enabled: !!community,
    staleTime: 60_000,
  })

const tagGroups = (community: string) =>
  queryOptions({
    queryKey: ['ticket', 'tag-groups', community] as const,
    queryFn: async () => {
      const data = await browserGraphQLRequest(ticketTagGroups, { community, thread: 'POST' })
      return data.communityTagGroups || []
    },
    enabled: !!community,
    staleTime: 60_000,
  })

export const ticketQueries = {
  kanban,
  page,
  detail,
  internalDetail,
  postLinksInternal,
  internalPage,
  postProgress,
  searchInternal,
  assigneeCandidates,
  tagGroups,
}
