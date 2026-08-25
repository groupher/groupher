import { queryOptions } from '@tanstack/react-query'
import { notFound } from '@tanstack/react-router'
import { print } from 'graphql'

import { THREAD } from '~/const/thread'
import { articleKeys, commentKeys } from '~/query'
import { docPublicTree } from '~/schemas/pages/doc'
import type { TDocPublicTreeQuery, TThread } from '~/spec'

import {
  loadChangelog,
  loadChangelogs,
  loadComments,
  loadCommunity,
  loadDoc,
  loadDocTree,
  loadKanban,
  loadPost,
  loadPosts,
} from '../server/community'

export const communityKeys = {
  shell: (community: string) => ['community', community] as const,
}

export const communityQueries = {
  shell: (community: string) =>
    queryOptions({
      queryKey: communityKeys.shell(community),
      queryFn: async () => {
        const shell = await loadCommunity({ data: { community } })
        if (!shell) throw notFound()
        return shell
      },
      staleTime: 60_000,
      gcTime: 10 * 60_000,
    }),
  posts: (community: string) =>
    queryOptions({
      queryKey: articleKeys.posts({ community, page: 1, size: 20 }),
      queryFn: () => loadPosts({ data: { community } }),
      staleTime: 30_000,
      gcTime: 10 * 60_000,
    }),
  post: (community: string, innerId: string) =>
    queryOptions({
      queryKey: articleKeys.detail(community, THREAD.POST, innerId),
      queryFn: () => loadPost({ data: { community, innerId } }),
      staleTime: 60_000,
      gcTime: 10 * 60_000,
    }),
  changelogs: (community: string) =>
    queryOptions({
      queryKey: articleKeys.changelogs({ community, page: 1, size: 20 }),
      queryFn: () => loadChangelogs({ data: { community } }),
      staleTime: 30_000,
      gcTime: 10 * 60_000,
    }),
  changelog: (community: string, innerId: string) =>
    queryOptions({
      queryKey: articleKeys.detail(community, THREAD.CHANGELOG, innerId),
      queryFn: () => loadChangelog({ data: { community, innerId } }),
      staleTime: 60_000,
      gcTime: 10 * 60_000,
    }),
  comments: (community: string, thread: TThread, innerId: string) =>
    queryOptions({
      queryKey: commentKeys.list(community, thread, innerId, 1, 'REPLIES'),
      queryFn: () => loadComments({ data: { community, thread, innerId } }),
      staleTime: 30_000,
      gcTime: 10 * 60_000,
    }),
  kanban: (community: string) =>
    queryOptions({
      queryKey: articleKeys.kanban(community),
      queryFn: () => loadKanban({ data: { community } }),
      staleTime: 30_000,
      gcTime: 10 * 60_000,
    }),
  doc: (community: string, innerId: string) =>
    queryOptions({
      queryKey: articleKeys.detail(community, THREAD.DOC, innerId),
      queryFn: () => loadDoc({ data: { community, innerId } }),
      staleTime: 60_000,
      gcTime: 10 * 60_000,
    }),
}

export const docTreeClientQuery = (community: string) =>
  queryOptions<TDocPublicTreeQuery>({
    queryKey: ['graphql', print(docPublicTree), { community }],
    queryFn: async () => ({ docPublicTree: await loadDocTree({ data: { community } }) }),
  })
