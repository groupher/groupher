import {
  loadKanban,
  loadPagedChangelogs,
  loadPagedPosts,
  loadTicketInternal,
} from '@dash/server/cms'
import { queryOptions } from '@tanstack/react-query'

import { DEFAULT_EFFECTIVE_PAGI_CONFIG } from '~/lib/pagination/params'
import { articleQueryKeys, ticketQueryKeys } from '~/query'

export const dashQueries = {
  ticketInternal: (community: string, id: string) =>
    queryOptions({
      queryKey: ticketQueryKeys.internalDetail(community, id),
      queryFn: () => loadTicketInternal({ data: { community, id } }),
      staleTime: 60_000,
    }),
  posts: (community: string, config = DEFAULT_EFFECTIVE_PAGI_CONFIG) =>
    queryOptions({
      queryKey: articleQueryKeys.pagiPosts(
        { community, page: 1, size: config.defaultSize },
        { ...config, api: 'offset', mode: 'page' },
      ),
      queryFn: () =>
        loadPagedPosts({
          data: {
            community,
            pagi: {
              offset: { page: 1, size: config.defaultSize, configRevision: config.revision },
            },
          },
        }),
      staleTime: 60_000,
    }),
  changelogs: (community: string, config = DEFAULT_EFFECTIVE_PAGI_CONFIG) =>
    queryOptions({
      queryKey: articleQueryKeys.pagiChangelogs(
        { community, page: 1, size: config.defaultSize },
        { ...config, api: 'offset', mode: 'page' },
      ),
      queryFn: () =>
        loadPagedChangelogs({
          data: {
            community,
            pagi: {
              offset: { page: 1, size: config.defaultSize, configRevision: config.revision },
            },
          },
        }),
      staleTime: 60_000,
    }),
  kanban: (community: string, config = DEFAULT_EFFECTIVE_PAGI_CONFIG) =>
    queryOptions({
      queryKey: ticketQueryKeys.kanban(community, 'internal', config.defaultSize),
      queryFn: () =>
        loadKanban({
          data: {
            community,
            pagi: {
              offset: {
                page: 1,
                size: config.defaultSize,
                configRevision: config.revision,
              },
            },
          },
        }),
      staleTime: 60_000,
    }),
}
