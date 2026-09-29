/**
 * Implements Community's server-function boundary for public GraphQL reads.
 *
 *   TanStack route loader
 *     -> typed server function
 *     -> Phoenix GraphQL + public cache headers
 *     -> normalized public DTO for hydration
 *
 * Viewer-private state never crosses this SSR boundary. ArticleStats uses the same normalizer as
 * browser and mutation paths before entering the shared Query cache.
 */
import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core'
import { GROUPHER_COMMUNITY_SLUG_HEADER } from '@groupher/contracts/headers'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { THREAD } from '~/const/thread'
import { CACHE_TAG } from '~/constant/cache'
import { parseDashboard, parseWallpaper } from '~/lib/ssr/parse'
import { normalizeArticleStats } from '~/query/articleStatsNormalize'
import { articleStats as articleStatsDocument } from '~/schemas/pages/articleStats'
import { changelog, pagedChangelogs } from '~/schemas/pages/changelog'
import { pagedComments } from '~/schemas/pages/comment'
import { community as communityDocument } from '~/schemas/pages/community'
import { doc, docPublicTree } from '~/schemas/pages/doc'
import { groupedKanbanPosts, pagedPosts, post as postDocument } from '~/schemas/pages/post'
import type {
  TCommunity,
  TDoc,
  TDocPublicTree,
  TPagedChangelogs,
  TPagedComments,
  TPagedPosts,
  TPost,
  TParseDashboard,
  TThread,
} from '~/spec'

import { setPublicCacheHeaders } from './cache-headers'
import { fetchGraphQL } from './graphql'
import {
  isCommunityPathContextTrusted,
  isDirectCommunityOriginPage,
  isPlatformHost,
} from './public-path'

export type TCommunityShell = {
  community: TCommunity
  dashboard: TParseDashboard
  wallpaper: ReturnType<typeof parseWallpaper>
}

/** Loads the request-scoped community header used by every public Community server function. */
export const loadCommunityRequestContext = createServerFn({ method: 'GET', strict: false }).handler(
  async () => {
    const request = getRequest()
    const slug = request.headers.get(GROUPHER_COMMUNITY_SLUG_HEADER) || ''
    const pathname = new URL(request.url).pathname
    const host = (request.headers.get('x-forwarded-host') || new URL(request.url).host)
      .split(':')[0]
      .toLowerCase()
    return {
      customDomain: isCommunityPathContextTrusted(pathname, slug) && !isPlatformHost(host),
      directOriginPage: isDirectCommunityOriginPage(host, pathname),
    }
  },
)

const loadCommunity = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string }) => data)
  .handler(async ({ data }): Promise<TCommunityShell | null> => {
    setPublicCacheHeaders([CACHE_TAG.communityCache(data.community)])
    const communityPromise = fetchGraphQL<ResultOf<typeof communityDocument>>(
      communityDocument,
      { slug: data.community, userHasLogin: false },
      null,
      { allowErrorCodes: [5504] },
    )
    const result = await communityPromise
    const community = result.data?.community as unknown as TCommunity | null | undefined
    if (!community) return null
    const dashboard = parseDashboard(community)
    return {
      community,
      dashboard,
      wallpaper: parseWallpaper(community),
    }
  })

const loadPosts = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string }) => data)
  .handler(async ({ data }) => {
    setPublicCacheHeaders([CACHE_TAG.articlesCache(data.community, THREAD.POST)])
    const result = await fetchGraphQL<ResultOf<typeof pagedPosts>>(pagedPosts, {
      filter: { community: data.community, page: 1, size: 20 } satisfies VariablesOf<
        typeof pagedPosts
      >['filter'],
    })
    return result.data.pagedPosts as unknown as TPagedPosts | null
  })

const loadPost = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string; innerId: string }) => data)
  .handler(async ({ data }) => {
    setPublicCacheHeaders([
      CACHE_TAG.articleCache(data.community, THREAD.POST, data.innerId),
      CACHE_TAG.articlesCache(data.community, THREAD.POST),
    ])
    const result = await fetchGraphQL<ResultOf<typeof postDocument>>(postDocument, {
      article: { community: data.community, innerId: data.innerId, thread: 'POST' },
    })
    return (result.data?.post ?? null) as unknown as TPost | null
  })

const loadArticleStats = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string; thread: TThread; innerIds: string[] }) => data)
  .handler(async ({ data }) => {
    setPublicCacheHeaders([
      CACHE_TAG.articlesCache(data.community, data.thread),
      ...data.innerIds.map((innerId) =>
        CACHE_TAG.articleCache(data.community, data.thread, innerId),
      ),
    ])
    const result = await fetchGraphQL<ResultOf<typeof articleStatsDocument>>(articleStatsDocument, {
      community: data.community,
      thread: data.thread,
      innerIds: data.innerIds,
    })
    return (result.data?.articleStats ?? []).map(normalizeArticleStats)
  })

const loadChangelogs = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string }) => data)
  .handler(async ({ data }) => {
    setPublicCacheHeaders([CACHE_TAG.articlesCache(data.community, THREAD.CHANGELOG)])
    const result = await fetchGraphQL<ResultOf<typeof pagedChangelogs>>(pagedChangelogs, {
      filter: { community: data.community, page: 1, size: 20 },
    })
    return result.data?.pagedChangelogs as unknown as TPagedChangelogs | null
  })

const loadChangelog = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string; innerId: string }) => data)
  .handler(async ({ data }) => {
    setPublicCacheHeaders([
      CACHE_TAG.articleCache(data.community, THREAD.CHANGELOG, data.innerId),
      CACHE_TAG.articlesCache(data.community, THREAD.CHANGELOG),
    ])
    const result = await fetchGraphQL<ResultOf<typeof changelog>>(changelog, {
      article: { community: data.community, innerId: data.innerId, thread: THREAD.CHANGELOG },
    })
    return (result.data?.changelog ?? null) as unknown as TPost | null
  })

const loadKanban = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string }) => data)
  .handler(async ({ data }) => {
    setPublicCacheHeaders([CACHE_TAG.articlesCache(data.community, THREAD.KANBAN)])
    const result = await fetchGraphQL<ResultOf<typeof groupedKanbanPosts>>(groupedKanbanPosts, {
      community: data.community,
    })
    return result.data?.groupedKanbanPosts as unknown as Record<string, TPagedPosts> | null
  })

const loadDocTree = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string }) => data)
  .handler(async ({ data }) => {
    setPublicCacheHeaders([CACHE_TAG.docTreeCache(data.community)])
    const result = await fetchGraphQL<ResultOf<typeof docPublicTree>>(docPublicTree, {
      community: data.community,
    })
    return result.data?.docPublicTree as unknown as TDocPublicTree | null
  })

const loadDoc = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string; innerId: string }) => data)
  .handler(async ({ data }) => {
    setPublicCacheHeaders([CACHE_TAG.articleCache(data.community, THREAD.DOC, data.innerId)])
    const result = await fetchGraphQL<ResultOf<typeof doc>>(doc, {
      article: { community: data.community, innerId: data.innerId, thread: THREAD.DOC },
    })
    return (result.data?.doc ?? null) as unknown as TDoc | null
  })

const loadComments = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string; thread: TThread; innerId: string }) => data)
  .handler(async ({ data }) => {
    setPublicCacheHeaders([CACHE_TAG.commentsCache(data.community, data.thread, data.innerId)])
    const result = await fetchGraphQL<ResultOf<typeof pagedComments>>(pagedComments, {
      article: { community: data.community, thread: data.thread, innerId: data.innerId },
      mode: 'REPLIES',
      filter: { page: 1, size: 30 },
    })
    return result.data?.pagedComments as unknown as TPagedComments | null
  })

export {
  loadChangelog,
  loadChangelogs,
  loadArticleStats,
  loadComments,
  loadCommunity,
  loadDoc,
  loadDocTree,
  loadKanban,
  loadPost,
  loadPosts,
}
