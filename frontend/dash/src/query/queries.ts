import { loadKanban, loadPagedChangelogs, loadPagedPosts } from '@dash/server/cms'
import { queryOptions } from '@tanstack/react-query'

import { articleQueryKeys } from '~/query'

export const dashQueries = {
  posts: (community: string) =>
    queryOptions({
      queryKey: articleQueryKeys.posts({ community, page: 1, size: 20 }),
      queryFn: () => loadPagedPosts({ data: { community } }),
      staleTime: 60_000,
    }),
  changelogs: (community: string) =>
    queryOptions({
      queryKey: articleQueryKeys.changelogs({ community, page: 1, size: 20 }),
      queryFn: () => loadPagedChangelogs({ data: { community } }),
      staleTime: 60_000,
    }),
  kanban: (community: string) =>
    queryOptions({
      queryKey: articleQueryKeys.kanban(community),
      queryFn: () => loadKanban({ data: { community } }),
      staleTime: 60_000,
    }),
}
