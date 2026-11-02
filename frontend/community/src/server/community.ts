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
import type { ResultOf } from '@graphql-typed-document-node/core'
import { GROUPHER_COMMUNITY_SLUG_HEADER } from '@groupher/contracts/headers'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { THREAD } from '~/const/thread'
import { CACHE_TAG } from '~/constant/cache'
import { parseDashboard, parseWallpaper } from '~/lib/ssr/parse'
import { normalizeArticleStats } from '~/query/articleStatsNormalize'
import { normalizeCommentPage, type TCommentCollection } from '~/query/commentPage'
import { toArticlePageFilter } from '~/query/filter'
import { articleStats as articleStatsDocument } from '~/schemas/pages/articleStats'
import { changelog, changelogPage } from '~/schemas/pages/changelog'
import { commentPage } from '~/schemas/pages/comment'
import { community as communityDocument } from '~/schemas/pages/community'
import { doc, docPublicTree } from '~/schemas/pages/doc'
import { post as postDocument, postPage } from '~/schemas/pages/post'
import {
  postTicketProgress as postTicketProgressDocument,
  ticket as ticketDocument,
  ticketKanban,
} from '~/schemas/pages/ticket'
import type {
  TCommunity,
  TDoc,
  TDocPublicTree,
  TPagiGraphQLInput,
  TPagedArticlesParams,
  TPagedTickets,
  TPostTicketProgress,
  TPost,
  TParseDashboard,
  TThread,
} from '~/spec'

import { setPublicCacheHeaders } from './cache-headers'
import { fetchGraphQL, setPrivateCacheHeader } from './graphql'
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

/** Reads bootstrap directly from Phoenix, sharing only the transport normalization. */
const readCommunityShell = async (communitySlug: string): Promise<TCommunityShell | null> => {
  const result = await fetchGraphQL<ResultOf<typeof communityDocument>>(
    communityDocument,
    { slug: communitySlug, userHasLogin: false },
    null,
    { allowErrorCodes: [5504] },
  )
  const community = result.data?.community as unknown as TCommunity | null | undefined
  if (!community) return null
  return { community, dashboard: parseDashboard(community), wallpaper: parseWallpaper(community) }
}

const loadCommunity = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string }) => data)
  .handler(async ({ data }): Promise<TCommunityShell | null> => {
    setPublicCacheHeaders([CACHE_TAG.communityCache(data.community)])
    return readCommunityShell(data.community)
  })

/** Bypasses browser/CDN GET bootstrap caches after pagination revision mismatch. */
export const refreshCommunity = createServerFn({ method: 'POST', strict: false })
  .validator((data: { community: string }) => data)
  .handler(async ({ data }): Promise<TCommunityShell | null> => {
    setPrivateCacheHeader()
    return readCommunityShell(data.community)
  })

/** Prevents a failed list/recovery shell from entering shared HTTP caches. */
const withArticlePageCachePolicy = async <T>(read: () => Promise<T>): Promise<T> => {
  try {
    return await read()
  } catch (error) {
    setPrivateCacheHeader()
    throw error
  }
}

const setCommunityPageCacheHeaders = (community: string, tags: readonly string[]): void => {
  setPublicCacheHeaders([CACHE_TAG.communityCache(community), ...tags])
}

const loadPosts = createServerFn({ method: 'GET', strict: false })
  .validator(
    (data: { community: string; filter?: TPagedArticlesParams; pagi?: TPagiGraphQLInput }) => data,
  )
  .handler(async ({ data }) =>
    withArticlePageCachePolicy(async () => {
      setCommunityPageCacheHeaders(data.community, [
        CACHE_TAG.articlesCache(data.community, THREAD.POST),
      ])
      const filter = data.filter || { community: data.community }
      const result = await fetchGraphQL<ResultOf<typeof postPage>>(postPage, {
        filter: toArticlePageFilter(filter),
        thread: 'POST',
        pagi: data.pagi,
      })
      return result.data?.postPage ?? null
    }),
  )

const loadPost = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string; innerId: string }) => data)
  .handler(async ({ data }) => {
    setCommunityPageCacheHeaders(data.community, [
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
    setCommunityPageCacheHeaders(data.community, [
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
  .validator(
    (data: { community: string; filter?: TPagedArticlesParams; pagi?: TPagiGraphQLInput }) => data,
  )
  .handler(async ({ data }) =>
    withArticlePageCachePolicy(async () => {
      setCommunityPageCacheHeaders(data.community, [
        CACHE_TAG.articlesCache(data.community, THREAD.CHANGELOG),
      ])
      const filter = data.filter || { community: data.community }
      const result = await fetchGraphQL<ResultOf<typeof changelogPage>>(changelogPage, {
        filter: toArticlePageFilter(filter),
        thread: 'CHANGELOG',
        pagi: data.pagi,
      })
      return result.data?.changelogPage ?? null
    }),
  )

const loadChangelog = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string; innerId: string }) => data)
  .handler(async ({ data }) => {
    setCommunityPageCacheHeaders(data.community, [
      CACHE_TAG.articleCache(data.community, THREAD.CHANGELOG, data.innerId),
      CACHE_TAG.articlesCache(data.community, THREAD.CHANGELOG),
    ])
    const result = await fetchGraphQL<ResultOf<typeof changelog>>(changelog, {
      article: { community: data.community, innerId: data.innerId, thread: THREAD.CHANGELOG },
    })
    return (result.data?.changelog ?? null) as unknown as TPost | null
  })

const loadKanban = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string; pagi: TPagiGraphQLInput }) => data)
  .handler(async ({ data }) => {
    setCommunityPageCacheHeaders(data.community, [CACHE_TAG.ticketListCache(data.community)])
    const result = await fetchGraphQL<ResultOf<typeof ticketKanban>>(ticketKanban, {
      community: data.community,
      pagi: data.pagi,
    })
    return result.data?.ticketKanban as unknown as Record<
      'todo' | 'wip' | 'done',
      TPagedTickets
    > | null
  })

const loadTicket = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string; innerId: number }) => data)
  .handler(async ({ data }) => {
    setCommunityPageCacheHeaders(data.community, [
      CACHE_TAG.ticketDetailCache(data.community, data.innerId),
    ])
    const result = await fetchGraphQL<ResultOf<typeof ticketDocument>>(ticketDocument, {
      community: data.community,
      innerId: data.innerId,
    })
    return result.data?.ticket ?? null
  })

const loadPostTicketProgress = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string; postInnerIds: number[] }) => data)
  .handler(async ({ data }) => {
    setCommunityPageCacheHeaders(data.community, [
      CACHE_TAG.articlesCache(data.community, THREAD.POST),
    ])
    const result = await fetchGraphQL<ResultOf<typeof postTicketProgressDocument>>(
      postTicketProgressDocument,
      { community: data.community, postInnerIds: data.postInnerIds },
    )
    return (result.data?.postTicketProgress ?? []) as unknown as readonly TPostTicketProgress[]
  })

const loadDocTree = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string }) => data)
  .handler(async ({ data }) => {
    setCommunityPageCacheHeaders(data.community, [CACHE_TAG.docTreeCache(data.community)])
    const result = await fetchGraphQL<ResultOf<typeof docPublicTree>>(docPublicTree, {
      community: data.community,
    })
    return result.data?.docPublicTree as unknown as TDocPublicTree | null
  })

const loadDoc = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string; innerId: string }) => data)
  .handler(async ({ data }) => {
    setCommunityPageCacheHeaders(data.community, [
      CACHE_TAG.articleCache(data.community, THREAD.DOC, data.innerId),
    ])
    const result = await fetchGraphQL<ResultOf<typeof doc>>(doc, {
      article: { community: data.community, innerId: data.innerId, thread: THREAD.DOC },
    })
    return (result.data?.doc ?? null) as unknown as TDoc | null
  })

const loadComments = createServerFn({ method: 'GET', strict: false })
  .validator((data: { collection: TCommentCollection; pagi: TPagiGraphQLInput }) => data)
  .handler(async ({ data: { collection, pagi } }) => {
    const { community, thread, innerId } = collection.article
    setCommunityPageCacheHeaders(community, [
      CACHE_TAG.commentsListCache(community),
      CACHE_TAG.commentsCache(community, thread, innerId),
    ])
    const result = await fetchGraphQL<ResultOf<typeof commentPage>>(commentPage, {
      article: collection.article,
      mode: collection.mode,
      filter: { sort: collection.sort || 'ASC_INSERTED' },
      pagi,
    })
    if (!result.data?.commentPage) throw new Error('Comment page is unavailable')
    return normalizeCommentPage(result.data.commentPage)
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
  loadTicket,
  loadPostTicketProgress,
  loadPosts,
}
