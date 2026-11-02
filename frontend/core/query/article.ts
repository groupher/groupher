import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'

import { THREAD } from '~/const/thread'
import { browserGraphQLRequest } from '~/graphql/client'
import { DEFAULT_EFFECTIVE_PAGI_CONFIG, toPagiGraphQLInput } from '~/lib/pagination/params'
import { changelog, changelogPage } from '~/schemas/pages/changelog'
import { doc } from '~/schemas/pages/doc'
import { communityTagGroups, communityTagStats } from '~/schemas/pages/misc'
import { post, postPage } from '~/schemas/pages/post'
import type {
  TEffectivePagiConfig,
  TPagedArticlesParams,
  TPagiRequest,
  TPost,
  TTagStats,
  TTagGroup,
  TThread,
} from '~/spec'

import { articleStats, articleStatsBatch } from './articleStats'
import { toArticlePageFilter } from './filter'
import { articleQueryKeys } from './key'

/** Builds the GraphQL pagination request while preserving the configured API and revision. */
export const articlePagiRequest = (
  filter: TPagedArticlesParams,
  config: TEffectivePagiConfig,
  after?: string | null,
): TPagiRequest => {
  if (config.api === 'offset') {
    return {
      api: 'offset',
      page: filter.page ?? 1,
      size: filter.size ?? config.defaultSize,
      configRevision: config.revision,
    }
  }

  return {
    api: 'cursor',
    first: filter.size ?? config.defaultSize,
    ...((after ?? filter.after) ? { after: (after ?? filter.after)! } : {}),
    configRevision: config.revision,
  }
}

/** Reads the shared Article page contract. */
const posts = (filter: TPagedArticlesParams, config = DEFAULT_EFFECTIVE_PAGI_CONFIG) =>
  queryOptions({
    queryKey: articleQueryKeys.pagiPosts(filter, config, articlePagiRequest(filter, config)),
    meta: { hydration: 'public' },
    queryFn: async () => {
      const request = articlePagiRequest(filter, config)
      const data = await browserGraphQLRequest(postPage, {
        pagi: toPagiGraphQLInput(request),
        filter: toArticlePageFilter(filter),
        thread: 'POST',
      })
      return data.postPage
    },
  })

/** Reads the shared Changelog page contract. */
const changelogs = (filter: TPagedArticlesParams, config = DEFAULT_EFFECTIVE_PAGI_CONFIG) =>
  queryOptions({
    queryKey: articleQueryKeys.pagiChangelogs(filter, config, articlePagiRequest(filter, config)),
    meta: { hydration: 'public' },
    queryFn: async () => {
      const request = articlePagiRequest(filter, config)
      const data = await browserGraphQLRequest(changelogPage, {
        pagi: toPagiGraphQLInput(request),
        filter: toArticlePageFilter(filter),
        thread: 'CHANGELOG',
      })
      return data.changelogPage
    },
  })

/** Builds the infinite-query contract for cursor/load-more Article surfaces. */
const postsInfinite = (filter: TPagedArticlesParams, config: TEffectivePagiConfig) =>
  infiniteQueryOptions({
    queryKey: articleQueryKeys.pagiPosts(filter, config, articlePagiRequest(filter, config)),
    initialPageParam: filter.after ?? (null as string | null),
    meta: { hydration: 'public' },
    queryFn: async ({ pageParam }) => {
      const data = await browserGraphQLRequest(postPage, {
        pagi: toPagiGraphQLInput(articlePagiRequest(filter, config, pageParam)),
        filter: toArticlePageFilter(filter),
        thread: 'POST',
      })
      return data.postPage
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.pageInfo.__typename !== 'CursorPageInfo') return undefined
      return lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.endCursor : undefined
    },
  })

/** Builds the infinite-query contract for cursor/load-more Changelog surfaces. */
const changelogsInfinite = (filter: TPagedArticlesParams, config: TEffectivePagiConfig) =>
  infiniteQueryOptions({
    queryKey: articleQueryKeys.pagiChangelogs(filter, config, articlePagiRequest(filter, config)),
    initialPageParam: filter.after ?? (null as string | null),
    meta: { hydration: 'public' },
    queryFn: async ({ pageParam }) => {
      const data = await browserGraphQLRequest(changelogPage, {
        pagi: toPagiGraphQLInput(articlePagiRequest(filter, config, pageParam)),
        filter: toArticlePageFilter(filter),
        thread: 'CHANGELOG',
      })
      return data.changelogPage
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.pageInfo.__typename !== 'CursorPageInfo') return undefined
      return lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.endCursor : undefined
    },
  })

const detail = (community: string, thread: TThread, innerId: string | number) =>
  queryOptions({
    queryKey: articleQueryKeys.detail(community, thread, innerId),
    meta: { hydration: 'public' },
    queryFn: async () => {
      const article = { community, thread, innerId: String(innerId) }
      if (thread === THREAD.CHANGELOG) {
        const data = await browserGraphQLRequest(changelog, {
          article,
        })
        return data.changelog as unknown as TPost
      }
      if (thread === THREAD.DOC) {
        const data = await browserGraphQLRequest(doc, {
          article,
        })
        return data.doc as unknown as TPost
      }
      const data = await browserGraphQLRequest(post, {
        article,
      })
      return data.post as unknown as TPost
    },
  })

const tagStats = (community: string, thread: TThread, slug: string | null | undefined) =>
  queryOptions({
    queryKey: articleQueryKeys.tagStats(community, thread, slug),
    queryFn: async () => {
      if (!slug) return null
      const data = await browserGraphQLRequest(communityTagStats, { community, thread, slug })
      return data.communityTagStats ? ({ ...data.communityTagStats, slug } as TTagStats) : null
    },
    enabled: !!community && !!thread && !!slug,
  })

const tagGroups = (community: string, thread: TThread) =>
  queryOptions({
    queryKey: articleQueryKeys.tagGroups(community, thread),
    queryFn: async () => {
      const data = await browserGraphQLRequest(communityTagGroups, { community, thread })
      return (data.communityTagGroups || []) as unknown as TTagGroup[]
    },
    enabled: !!community && !!thread,
    staleTime: 60_000,
  })

export const articleQueries = {
  posts,
  changelogs,
  postsInfinite,
  changelogsInfinite,
  detail,
  tagGroups,
  tagStats,
  stats: articleStats,
  statsBatch: articleStatsBatch,
}
