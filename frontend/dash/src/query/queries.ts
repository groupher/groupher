import { loadKanban, loadPagedChangelogs, loadPagedPosts } from '@dash/server/cms'
import { queryOptions } from '@tanstack/react-query'

import { articleKeys } from '~/query'

export const dashQueries = {
  posts: (community: string) =>
    queryOptions({
      queryKey: articleKeys.posts({ community, page: 1, size: 20 }),
      queryFn: () => loadPagedPosts({ data: { community } }),
      staleTime: 60_000,
    }),
  changelogs: (community: string) =>
    queryOptions({
      queryKey: articleKeys.changelogs({ community, page: 1, size: 20 }),
      queryFn: () => loadPagedChangelogs({ data: { community } }),
      staleTime: 60_000,
    }),
  kanban: (community: string) =>
    queryOptions({
      queryKey: articleKeys.kanban(community),
      queryFn: () => loadKanban({ data: { community } }),
      staleTime: 60_000,
    }),
}
