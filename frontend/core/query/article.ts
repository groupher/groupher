import type { VariablesOf } from '@graphql-typed-document-node/core'
import { queryOptions } from '@tanstack/react-query'

import { THREAD } from '~/const/thread'
import { browserQuery } from '~/graphql/client'
import { changelog, pagedChangelogs } from '~/schemas/pages/changelog'
import { doc } from '~/schemas/pages/doc'
import { communityTagGroups, communityTagStats } from '~/schemas/pages/misc'
import { groupedKanbanPosts, pagedPosts, post } from '~/schemas/pages/post'
import type {
  TPagedArticlesParams,
  TPagedChangelogs,
  TPagedPosts,
  TPost,
  TTagStats,
  TTagGroup,
  TThread,
} from '~/spec'

import { articleKeys, normalizeArticleFilter } from './key'

type TGroupedKanbanPosts = {
  backlog: TPagedPosts
  todo: TPagedPosts
  wip: TPagedPosts
  done: TPagedPosts
  rejected: TPagedPosts
}

const toPostsFilter = (filter: TPagedArticlesParams): VariablesOf<typeof pagedPosts>['filter'] => {
  const normalized = normalizeArticleFilter(filter)
  return {
    community: normalized.community,
    page: normalized.page,
    size: normalized.size,
    communityTag: normalized.communityTag,
    communityTags: normalized.communityTags,
    cat: normalized.cat as VariablesOf<typeof pagedPosts>['filter']['cat'],
    status: normalized.status as VariablesOf<typeof pagedPosts>['filter']['status'],
    order: normalized.order as VariablesOf<typeof pagedPosts>['filter']['order'],
    when: normalized.when as VariablesOf<typeof pagedPosts>['filter']['when'],
    sort: normalized.sort as VariablesOf<typeof pagedPosts>['filter']['sort'],
  }
}

const posts = (filter: TPagedArticlesParams) =>
  queryOptions({
    queryKey: articleKeys.posts(filter),
    queryFn: async () => {
      const data = await browserQuery(pagedPosts, {
        filter: toPostsFilter(filter),
        userHasLogin: false,
      })
      return data.pagedPosts as unknown as TPagedPosts
    },
  })

const changelogs = (filter: TPagedArticlesParams) =>
  queryOptions({
    queryKey: articleKeys.changelogs(filter),
    queryFn: async () => {
      const data = await browserQuery(pagedChangelogs, {
        filter: toPostsFilter(filter) as VariablesOf<typeof pagedChangelogs>['filter'],
        userHasLogin: false,
      })
      return data.pagedChangelogs as unknown as TPagedChangelogs
    },
  })

const kanban = (community: string) =>
  queryOptions({
    queryKey: articleKeys.kanban(community),
    queryFn: async () => {
      const data = await browserQuery(groupedKanbanPosts, { community })
      return data.groupedKanbanPosts as unknown as TGroupedKanbanPosts
    },
    enabled: !!community,
  })

const detail = (community: string, thread: TThread, innerId: string | number) =>
  queryOptions({
    queryKey: articleKeys.detail(community, thread, innerId),
    queryFn: async () => {
      const article = { community, thread, innerId: String(innerId) }
      if (thread === THREAD.CHANGELOG) {
        const data = await browserQuery(changelog, { article, userHasLogin: false })
        return data.changelog as unknown as TPost
      }
      if (thread === THREAD.DOC) {
        const data = await browserQuery(doc, { article, userHasLogin: false })
        return data.doc as unknown as TPost
      }
      const data = await browserQuery(post, { article, userHasLogin: false })
      return data.post as unknown as TPost
    },
  })

const tagStats = (community: string, thread: TThread, slug: string | null | undefined) =>
  queryOptions({
    queryKey: articleKeys.tagStats(community, thread, slug),
    queryFn: async () => {
      if (!slug) return null
      const data = await browserQuery(communityTagStats, { community, thread, slug })
      return data.communityTagStats ? ({ ...data.communityTagStats, slug } as TTagStats) : null
    },
    enabled: !!community && !!thread && !!slug,
  })

const tagGroups = (community: string, thread: TThread) =>
  queryOptions({
    queryKey: articleKeys.tagGroups(community, thread),
    queryFn: async () => {
      const data = await browserQuery(communityTagGroups, { community, thread })
      return (data.communityTagGroups || []) as unknown as TTagGroup[]
    },
    enabled: !!community && !!thread,
    staleTime: 60_000,
  })

export const articleQueries = { posts, changelogs, kanban, detail, tagGroups, tagStats }
