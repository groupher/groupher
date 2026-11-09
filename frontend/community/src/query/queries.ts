/**
 * Declares Community host Query options over Core's canonical cache contracts.
 *
 *   route loader/component input
 *     -> communityQueries
 *     -> server function or browser GraphQL request
 *     -> Core Article/query keys + owner-wise structural sharing
 *
 * The host selects transport and hydration policy only; ArticleStats normalization, keys, and merge
 * semantics remain owned by Core.
 */
import { infiniteQueryOptions, type QueryClient, queryOptions } from '@tanstack/react-query'
import { print } from 'graphql'

import { THREAD } from '~/const/thread'
import { DEFAULT_EFFECTIVE_PAGI_CONFIG, toPagiGraphQLInput } from '~/lib/pagination/params'
import { articleQueryKeys, graphqlKeys, ticketQueryKeys, ticketQueries } from '~/query'
import { articlePagiRequest } from '~/query/article'
import { articlePathKey } from '~/query/articlePath'
import {
  ARTICLE_STATS_SNAPSHOT_MAX_AGE_MS,
  articleStatsBatchStructuralSharing,
  articleStatsStructuralSharing,
} from '~/query/articleStats'
import { commentQueries } from '~/query/comment'
import { commentPagiRequest } from '~/query/commentPage'
import { docPublicTree } from '~/schemas/pages/doc'
import type { TEffectivePagiConfig, TPagedArticlesParams, TPagiRequest } from '~/spec'
import type { TDocPublicTreeQuery, TThread, TArticleThread } from '~/spec'

import {
  loadBlog,
  loadChangelog,
  loadChangelogs,
  loadArticleStats,
  loadComments,
  loadDoc,
  loadDocTree,
  loadKanban,
  loadPost,
  loadTicket,
  loadPostTicketProgress,
  loadPosts,
} from '../server/community'

const toCursorArticlePageRequest = (
  filter: TPagedArticlesParams,
  config: TEffectivePagiConfig,
  after: string | null | undefined,
): TPagiRequest => articlePagiRequest(filter, config, after)

/** Community host query options that preserve Core keys, normalization, and merge policies. */
export const communityQueries = {
  blog: (community: string, innerId: string) =>
    queryOptions({
      queryKey: articleQueryKeys.detail(community, THREAD.BLOG, innerId),
      queryFn: () => loadBlog({ data: { community, innerId } }),
      gcTime: 10 * 60_000,
      meta: { hydration: 'public' },
    }),
  posts: (
    community: string,
    config: TEffectivePagiConfig = DEFAULT_EFFECTIVE_PAGI_CONFIG,
    filter: TPagedArticlesParams = { community },
  ) =>
    queryOptions({
      queryKey: articleQueryKeys.pagiPosts(filter, config, articlePagiRequest(filter, config)),
      queryFn: async () => {
        const page = await loadPosts({
          data: {
            community,
            filter,
            pagi: toPagiGraphQLInput(articlePagiRequest(filter, config)),
          },
        })
        return page
      },
      gcTime: 10 * 60_000,
      meta: { hydration: 'public' },
    }),
  postsInfinite: (
    community: string,
    config: TEffectivePagiConfig = DEFAULT_EFFECTIVE_PAGI_CONFIG,
    filter: TPagedArticlesParams = { community },
  ) =>
    infiniteQueryOptions({
      queryKey: articleQueryKeys.pagiPosts(
        filter,
        config,
        toCursorArticlePageRequest(filter, config, null),
      ),
      initialPageParam: filter.after ?? (null as string | null),
      queryFn: ({ pageParam }) =>
        loadPosts({
          data: {
            community,
            filter,
            pagi: toPagiGraphQLInput(toCursorArticlePageRequest(filter, config, pageParam)),
          },
        }).then((page) => {
          if (!page) throw new Error('Community post page is unavailable.')
          return page
        }),
      getNextPageParam: (lastPage) => {
        if (lastPage.pageInfo.__typename !== 'CursorPageInfo') return undefined
        return lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.endCursor : undefined
      },
      gcTime: 10 * 60_000,
      meta: { hydration: 'public' },
    }),
  post: (community: string, innerId: string) =>
    queryOptions({
      queryKey: articleQueryKeys.detail(community, THREAD.POST, innerId),
      queryFn: () => loadPost({ data: { community, innerId } }),
      gcTime: 10 * 60_000,
      meta: { hydration: 'public' },
    }),
  ticket: (community: string, innerId: number) =>
    queryOptions({
      ...ticketQueries.detail(community, innerId),
      queryFn: () => loadTicket({ data: { community, innerId } }),
      meta: { hydration: 'public' },
    }),
  postTicketProgress: (community: string, postInnerIds: number[]) =>
    queryOptions({
      queryKey: ticketQueryKeys.postProgress(
        community,
        [...new Set(postInnerIds)].sort((a, b) => a - b),
      ),
      queryFn: () => loadPostTicketProgress({ data: { community, postInnerIds } }),
      gcTime: 10 * 60_000,
      meta: { hydration: 'public' },
    }),
  changelogs: (
    community: string,
    config: TEffectivePagiConfig = DEFAULT_EFFECTIVE_PAGI_CONFIG,
    filter: TPagedArticlesParams = { community },
  ) =>
    queryOptions({
      queryKey: articleQueryKeys.pagiChangelogs(filter, config, articlePagiRequest(filter, config)),
      queryFn: async () => {
        const page = await loadChangelogs({
          data: {
            community,
            filter,
            pagi: toPagiGraphQLInput(articlePagiRequest(filter, config)),
          },
        })
        return page
      },
      gcTime: 10 * 60_000,
      meta: { hydration: 'public' },
    }),
  changelogsInfinite: (
    community: string,
    config: TEffectivePagiConfig = DEFAULT_EFFECTIVE_PAGI_CONFIG,
    filter: TPagedArticlesParams = { community },
  ) =>
    infiniteQueryOptions({
      queryKey: articleQueryKeys.pagiChangelogs(
        filter,
        config,
        toCursorArticlePageRequest(filter, config, null),
      ),
      initialPageParam: filter.after ?? (null as string | null),
      queryFn: ({ pageParam }) =>
        loadChangelogs({
          data: {
            community,
            filter,
            pagi: toPagiGraphQLInput(toCursorArticlePageRequest(filter, config, pageParam)),
          },
        }).then((page) => {
          if (!page) throw new Error('Community changelog page is unavailable.')
          return page
        }),
      getNextPageParam: (lastPage) => {
        if (lastPage.pageInfo.__typename !== 'CursorPageInfo') return undefined
        return lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.endCursor : undefined
      },
      gcTime: 10 * 60_000,
      meta: { hydration: 'public' },
    }),
  changelog: (community: string, innerId: string) =>
    queryOptions({
      queryKey: articleQueryKeys.detail(community, THREAD.CHANGELOG, innerId),
      queryFn: () => loadChangelog({ data: { community, innerId } }),
      gcTime: 10 * 60_000,
      meta: { hydration: 'public' },
    }),
  comments: (
    community: string,
    thread: TArticleThread,
    innerId: string,
    config: TEffectivePagiConfig = DEFAULT_EFFECTIVE_PAGI_CONFIG,
    page = 1,
  ) => {
    const collection = { article: { community, thread, innerId }, mode: 'REPLIES' as const }
    return queryOptions({
      ...commentQueries.page(collection, config, page),
      queryFn: () =>
        loadComments({
          data: { collection, pagi: toPagiGraphQLInput(commentPagiRequest(config, page)) },
        }),
      gcTime: 10 * 60_000,
      meta: { hydration: 'public' },
    })
  },
  commentsInfinite: (
    community: string,
    thread: TArticleThread,
    innerId: string,
    config: TEffectivePagiConfig,
    initialAfter?: string,
  ) => {
    const collection = {
      initialAfter,
      article: { community, thread, innerId },
      mode: 'REPLIES' as const,
    }
    return infiniteQueryOptions({
      ...commentQueries.infinite(collection, config),
      queryFn: ({ pageParam }) =>
        loadComments({
          data: { collection, pagi: toPagiGraphQLInput(commentPagiRequest(config, 1, pageParam)) },
        }),
      gcTime: 10 * 60_000,
      meta: { hydration: 'public' },
    })
  },
  kanban: (community: string, config = DEFAULT_EFFECTIVE_PAGI_CONFIG) =>
    queryOptions({
      queryKey: ticketQueryKeys.kanban(community, 'public', config.defaultSize),
      queryFn: () =>
        loadKanban({
          data: {
            community,
            pagi: toPagiGraphQLInput({
              api: 'offset',
              page: 1,
              size: config.defaultSize,
              configRevision: config.revision,
            }),
          },
        }),
      gcTime: 10 * 60_000,
      meta: { hydration: 'public' },
    }),
  doc: (community: string, innerId: string) =>
    queryOptions({
      queryKey: articleQueryKeys.detail(community, THREAD.DOC, innerId),
      queryFn: () => loadDoc({ data: { community, innerId } }),
      gcTime: 10 * 60_000,
      meta: { hydration: 'public' },
    }),
  stats: (
    queryClient: QueryClient,
    community: string,
    thread: TThread,
    innerIds: readonly (string | number)[],
  ) => {
    const queryKey = articleQueryKeys.statsBatch(community, thread, innerIds)
    return queryOptions({
      queryKey,
      queryFn: () =>
        loadArticleStats({ data: { community, thread, innerIds: innerIds.map(String) } }),
      staleTime: ARTICLE_STATS_SNAPSHOT_MAX_AGE_MS,
      gcTime: 10 * 60_000,
      meta: { hydration: 'public' },
      structuralSharing: articleStatsBatchStructuralSharing(queryClient, queryKey),
    })
  },
  stat: (
    queryClient: QueryClient,
    community: string,
    thread: TThread,
    innerId: string | number,
  ) => {
    const queryKey = articleQueryKeys.stats(community, thread, innerId)
    return queryOptions({
      queryKey,
      queryFn: async () => {
        const stats = await loadArticleStats({
          data: { community, thread, innerIds: [String(innerId)] },
        })
        const value = stats[0]
        if (!value)
          throw new Error(
            `ArticleStats unavailable for ${articlePathKey({ community, thread, innerId })}`,
          )
        return value
      },
      staleTime: ARTICLE_STATS_SNAPSHOT_MAX_AGE_MS,
      gcTime: 10 * 60_000,
      meta: { hydration: 'public' },
      structuralSharing: articleStatsStructuralSharing(queryClient, queryKey),
    })
  },
}

/** Defines the client cache contract for a community's public Docs tree. */
export const docTreeClientQuery = (community: string) =>
  queryOptions<TDocPublicTreeQuery>({
    queryKey: graphqlKeys.document(print(docPublicTree), { community }),
    queryFn: async () => ({ docPublicTree: await loadDocTree({ data: { community } }) }),
    meta: { hydration: 'public' },
  })
