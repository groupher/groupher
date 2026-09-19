import { queryOptions } from '@tanstack/react-query'
import { print } from 'graphql'

import { THREAD } from '~/const/thread'
import { articleKeys, commentKeys, graphqlKeys } from '~/query'
import { ARTICLE_STATS_SNAPSHOT_MAX_AGE_MS } from '~/query/articleStats'
import { docPublicTree } from '~/schemas/pages/doc'
import type { TDocPublicTreeQuery, TThread } from '~/spec'

import {
  loadChangelog,
  loadChangelogs,
  loadArticleStats,
  loadComments,
  loadDoc,
  loadDocTree,
  loadKanban,
  loadPost,
  loadPosts,
} from '../server/community'

export const communityQueries = {
  posts: (community: string) =>
    queryOptions({
      queryKey: articleKeys.posts({ community, page: 1, size: 20 }),
      queryFn: () => loadPosts({ data: { community } }),
      gcTime: 10 * 60_000,
      meta: { hydration: 'public' },
    }),
  post: (community: string, innerId: string) =>
    queryOptions({
      queryKey: articleKeys.detail(community, THREAD.POST, innerId),
      queryFn: () => loadPost({ data: { community, innerId } }),
      gcTime: 10 * 60_000,
      meta: { hydration: 'public' },
    }),
  changelogs: (community: string) =>
    queryOptions({
      queryKey: articleKeys.changelogs({ community, page: 1, size: 20 }),
      queryFn: () => loadChangelogs({ data: { community } }),
      gcTime: 10 * 60_000,
      meta: { hydration: 'public' },
    }),
  changelog: (community: string, innerId: string) =>
    queryOptions({
      queryKey: articleKeys.detail(community, THREAD.CHANGELOG, innerId),
      queryFn: () => loadChangelog({ data: { community, innerId } }),
      gcTime: 10 * 60_000,
      meta: { hydration: 'public' },
    }),
  comments: (community: string, thread: TThread, innerId: string) =>
    queryOptions({
      queryKey: commentKeys.list(community, thread, innerId, 1, 'REPLIES'),
      queryFn: () => loadComments({ data: { community, thread, innerId } }),
      gcTime: 10 * 60_000,
      meta: { hydration: 'public' },
    }),
  kanban: (community: string) =>
    queryOptions({
      queryKey: articleKeys.kanban(community),
      queryFn: () => loadKanban({ data: { community } }),
      gcTime: 10 * 60_000,
      meta: { hydration: 'public' },
    }),
  doc: (community: string, innerId: string) =>
    queryOptions({
      queryKey: articleKeys.detail(community, THREAD.DOC, innerId),
      queryFn: () => loadDoc({ data: { community, innerId } }),
      gcTime: 10 * 60_000,
      meta: { hydration: 'public' },
    }),
  articleStats: (community: string, thread: TThread, innerIds: readonly (string | number)[]) =>
    queryOptions({
      queryKey: articleKeys.articleStatsBatch(community, thread, innerIds),
      queryFn: () =>
        loadArticleStats({ data: { community, thread, innerIds: innerIds.map(String) } }),
      staleTime: ARTICLE_STATS_SNAPSHOT_MAX_AGE_MS,
      gcTime: 10 * 60_000,
      meta: { hydration: 'public' },
    }),
}

/** Defines the client cache contract for a community's public Docs tree. */
export const docTreeClientQuery = (community: string) =>
  queryOptions<TDocPublicTreeQuery>({
    queryKey: graphqlKeys.document(print(docPublicTree), { community }),
    queryFn: async () => ({ docPublicTree: await loadDocTree({ data: { community } }) }),
    meta: { hydration: 'public' },
  })
