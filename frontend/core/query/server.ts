import { dehydrate, HydrationBoundary, queryOptions } from '@tanstack/react-query'

import {
  getChangelog,
  getDoc,
  getGroupedKanbanPosts,
  getTagGroups,
  getPagedChangelogs,
  getPagedComments,
  getPagedPosts,
  getPost,
} from '~/app/ssr'
import { THREAD } from '~/const/thread'
import type { TPagedArticlesParams, TThread } from '~/spec'

import { articleKeys, commentKeys, isCanonicalDefaultArticleFilter } from './key'
import { createQueryClient } from './queryClient'

const posts = (filter: TPagedArticlesParams) =>
  queryOptions({
    queryKey: articleKeys.posts(filter),
    queryFn: async () => getPagedPosts(filter),
  })

const detail = (community: string, thread: TThread, innerId: string | number) =>
  queryOptions({
    queryKey: articleKeys.detail(community, thread, innerId),
    queryFn: async () =>
      thread === THREAD.CHANGELOG
        ? getChangelog(community, String(innerId))
        : thread === THREAD.DOC
          ? getDoc(community, String(innerId))
          : getPost(community, String(innerId), thread),
  })

const changelogs = (filter: TPagedArticlesParams) => {
  if (!isCanonicalDefaultArticleFilter(filter)) {
    throw new Error('Changelog SSR prefetch only supports the canonical default filter')
  }

  return queryOptions({
    queryKey: articleKeys.changelogs(filter),
    queryFn: async () => getPagedChangelogs(filter.community!),
  })
}

const kanban = (community: string) =>
  queryOptions({
    queryKey: articleKeys.kanban(community),
    queryFn: async () => getGroupedKanbanPosts(community),
  })

const tagGroups = (community: string, thread: TThread) =>
  queryOptions({
    queryKey: articleKeys.tagGroups(community, thread),
    queryFn: async () => getTagGroups(community, thread),
  })

const comments = (
  community: string,
  thread: TThread,
  innerId: string | number,
  page = 1,
  mode = 'REPLIES',
) =>
  queryOptions({
    queryKey: commentKeys.list(community, thread, innerId, page, mode),
    queryFn: async () => getPagedComments(community, String(innerId), page, thread),
  })

export const Q = {
  SSR: {
    article: { posts, changelogs, kanban, detail, tagGroups },
    comment: { list: comments },
  },
}

export { createQueryClient, dehydrate, HydrationBoundary }
