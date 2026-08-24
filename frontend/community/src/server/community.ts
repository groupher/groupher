import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core'
import { createServerFn } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'

import { THREAD } from '~/const/thread'
import { CACHE_TAG } from '~/constant/cache'
import { stripPagedCommentViewerState } from '~/lib/commentViewerState'
import { parseDashboard, parseWallpaper } from '~/lib/ssr/parse'
import { changelog, pagedChangelogs } from '~/schemas/pages/changelog'
import { pagedComments } from '~/schemas/pages/comment'
import { community as communityDocument } from '~/schemas/pages/community'
import { doc, docPublicTree } from '~/schemas/pages/doc'
import { groupedKanbanPosts, pagedPosts, post as postDocument } from '~/schemas/pages/post'
import { sessionState as sessionStateDocument } from '~/schemas/pages/user'
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
  TUser,
} from '~/spec'
import type { TInit as TAccountInit } from '~/stores/account/spec'

import { fetchGraphQL, getAuthToken, setPrivateCacheHeader } from './graphql'

export type TCommunityShell = {
  account: TAccountInit
  community: TCommunity
  dashboard: TParseDashboard
  wallpaper: ReturnType<typeof parseWallpaper>
}

const publicCacheHeader = (tags: string[]): void => {
  if (getAuthToken()) {
    setPrivateCacheHeader()
    return
  }

  setResponseHeader('cache-control', 'public, s-maxage=60, stale-while-revalidate=300')
  setResponseHeader('cache-tag', tags.join(', '))
}

const loadCommunity = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string }) => data)
  .handler(async ({ data }): Promise<TCommunityShell> => {
    const token = getAuthToken()
    publicCacheHeader([CACHE_TAG.communityCache(data.community)])
    const userHasLogin = Boolean(token)
    const communityPromise = fetchGraphQL<ResultOf<typeof communityDocument>>(
      communityDocument,
      { slug: data.community, userHasLogin },
      token,
    )
    const accountPromise = token
      ? loadAccount(token)
      : Promise.resolve<TAccountInit>({ loading: false, user: null })
    const [result, account] = await Promise.all([communityPromise, accountPromise])
    const community = result.data.community as unknown as TCommunity | null
    if (!community) throw new Error('Community was not found.')
    const dashboard = parseDashboard(community)
    return {
      account,
      community,
      dashboard,
      wallpaper: parseWallpaper(community),
    }
  })

const loadAccount = async (token: string): Promise<TAccountInit> => {
  const result = await fetchGraphQL<ResultOf<typeof sessionStateDocument>>(
    sessionStateDocument,
    {},
    token,
  )
  const session = result.data?.sessionState
  return {
    loading: false,
    user:
      session?.isValid && session.user
        ? { ...session.user, passport: session.user.passport as TUser['passport'] }
        : null,
  }
}

const loadPosts = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string }) => data)
  .handler(async ({ data }) => {
    publicCacheHeader([CACHE_TAG.articlesCache(data.community, THREAD.POST)])
    const result = await fetchGraphQL<ResultOf<typeof pagedPosts>>(pagedPosts, {
      filter: { community: data.community, page: 1, size: 20 } satisfies VariablesOf<
        typeof pagedPosts
      >['filter'],
      userHasLogin: false,
    })
    return result.data.pagedPosts as unknown as TPagedPosts | null
  })

const loadPost = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string; innerId: string }) => data)
  .handler(async ({ data }) => {
    publicCacheHeader([
      CACHE_TAG.articleCache(data.community, THREAD.POST, data.innerId),
      CACHE_TAG.articlesCache(data.community, THREAD.POST),
    ])
    const result = await fetchGraphQL<ResultOf<typeof postDocument>>(postDocument, {
      article: { community: data.community, innerId: data.innerId, thread: 'POST' },
      userHasLogin: false,
    })
    return (result.data?.post ?? null) as unknown as TPost | null
  })

const loadChangelogs = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string }) => data)
  .handler(async ({ data }) => {
    publicCacheHeader([CACHE_TAG.articlesCache(data.community, THREAD.CHANGELOG)])
    const result = await fetchGraphQL<ResultOf<typeof pagedChangelogs>>(pagedChangelogs, {
      filter: { community: data.community, page: 1, size: 20 },
      userHasLogin: false,
    })
    return result.data?.pagedChangelogs as unknown as TPagedChangelogs | null
  })

const loadChangelog = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string; innerId: string }) => data)
  .handler(async ({ data }) => {
    publicCacheHeader([
      CACHE_TAG.articleCache(data.community, THREAD.CHANGELOG, data.innerId),
      CACHE_TAG.articlesCache(data.community, THREAD.CHANGELOG),
    ])
    const result = await fetchGraphQL<ResultOf<typeof changelog>>(changelog, {
      article: { community: data.community, innerId: data.innerId, thread: THREAD.CHANGELOG },
      userHasLogin: false,
    })
    return (result.data?.changelog ?? null) as unknown as TPost | null
  })

const loadKanban = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string }) => data)
  .handler(async ({ data }) => {
    publicCacheHeader([CACHE_TAG.articlesCache(data.community, THREAD.KANBAN)])
    const result = await fetchGraphQL<ResultOf<typeof groupedKanbanPosts>>(groupedKanbanPosts, {
      community: data.community,
    })
    return result.data?.groupedKanbanPosts as unknown as Record<string, TPagedPosts> | null
  })

const loadDocTree = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string }) => data)
  .handler(async ({ data }) => {
    publicCacheHeader([CACHE_TAG.docTreeCache(data.community)])
    const result = await fetchGraphQL<ResultOf<typeof docPublicTree>>(docPublicTree, {
      community: data.community,
    })
    return result.data?.docPublicTree as unknown as TDocPublicTree | null
  })

const loadDoc = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string; innerId: string }) => data)
  .handler(async ({ data }) => {
    publicCacheHeader([CACHE_TAG.articleCache(data.community, THREAD.DOC, data.innerId)])
    const result = await fetchGraphQL<ResultOf<typeof doc>>(doc, {
      article: { community: data.community, innerId: data.innerId, thread: THREAD.DOC },
      userHasLogin: false,
    })
    return (result.data?.doc ?? null) as unknown as TDoc | null
  })

const loadComments = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string; thread: TThread; innerId: string }) => data)
  .handler(async ({ data }) => {
    publicCacheHeader([CACHE_TAG.commentsCache(data.community, data.thread, data.innerId)])
    const result = await fetchGraphQL<ResultOf<typeof pagedComments>>(pagedComments, {
      article: { community: data.community, thread: data.thread, innerId: data.innerId },
      mode: 'REPLIES',
      filter: { page: 1, size: 30 },
    })
    const comments = result.data?.pagedComments as unknown as TPagedComments | null
    return comments ? stripPagedCommentViewerState(comments) : null
  })

export {
  loadChangelog,
  loadChangelogs,
  loadComments,
  loadCommunity,
  loadDoc,
  loadDocTree,
  loadKanban,
  loadPost,
  loadPosts,
}
