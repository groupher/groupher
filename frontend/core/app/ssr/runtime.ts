import { cacheLife, cacheTag } from 'next/cache'
import { CACHE_TAG } from '~/const/cache'
import { LOCALE } from '~/const/i18n'
import { THREAD } from '~/const/thread'
import { loadLocaleFile } from '~/i18n'
import { getPagedArticlesParams } from '~/lib/pagedArticlesFilter'
import { P } from '~/schemas'
import type {
  TCommunityInfo,
  TLocale,
  TPagedArticlesParams,
  TPagedChangelogs,
  TPagedComments,
  TPagedPosts,
  TPost,
  TTag,
  TThread,
} from '~/spec'
import { gqFetch } from '~/utils/api'
import { parseDashboard, parseWallpaper } from '~/utils/ssr'
import { toGqlThread } from '~/utils/thread'

const getCommunity = async (community: string): Promise<TCommunityInfo> => {
  'use cache'
  cacheLife('days')
  cacheTag(CACHE_TAG.communityCache(community))

  const response = await gqFetch(P.community, { slug: community, userHasLogin: false })

  const { data, errors } = await response.json()

  // console.log('## data: ', data.community.dashboard.enable)

  if (errors) {
    // console.log('## error in fetching', P.community)
    console.log('## error details 1', errors)
    console.log('## error details 1', errors[0]?.locations)
    return {
      community: { slug: '' },
    }
  }

  return {
    community: data.community,
    dashboard: parseDashboard(data.community),
    wallpaper: parseWallpaper(data.community),
  }
}

export const getCommunityInfo = async (community$: string): Promise<TCommunityInfo> => {
  const communityInfo = await getCommunity(community$)

  const { community, dashboard, wallpaper } = communityInfo
  // console.log('## pagedArticles got in server: ', pagedArticles)

  const initState = {
    community,
    wallpaper,
    dashboard,
  }

  // console.log('## initState parseDashboard --> : ', initState.dashboard.original.headerLinks)

  return initState
}

export const getLocaleData = async (locale: TLocale = LOCALE.EN): Promise<any> => {
  'use cache'
  cacheLife('days')

  return loadLocaleFile(locale)
}

const fetchPagedPosts = async (filter: TPagedArticlesParams): Promise<TPagedPosts | null> => {
  const response = await gqFetch(P.pagedPosts, {
    filter,
    userHasLogin: false,
  })

  console.log('## fetch post filter: ', filter)

  const { data, errors } = await response.json()

  if (errors) {
    console.log('## error details', errors)
    return null
  }

  return data.pagedPosts
}

const getCachedPagedPosts = async (community: string): Promise<TPagedPosts | null> => {
  'use cache'
  cacheLife('minutes')
  cacheTag(CACHE_TAG.articlesCache(community, THREAD.POST))

  return fetchPagedPosts({ community, page: 1 })
}

const isDefaultPagedPostsFilter = (filter: TPagedArticlesParams) => {
  return (
    (filter.page || 1) === 1 &&
    !filter.communityTag &&
    !filter.cat &&
    !filter.state &&
    !filter.order
  )
}

export const getPagedPosts = async (filter: TPagedArticlesParams): Promise<TPagedPosts | null> => {
  if (isDefaultPagedPostsFilter(filter)) {
    return getCachedPagedPosts(filter.community || '')
  }

  return fetchPagedPosts(filter)
}

export const getPagedPostsFromSearchParams = async (
  community: string,
  searchParams?: URLSearchParams | Record<string, string | string[] | undefined> | null,
): Promise<TPagedPosts | null> => {
  return getPagedPosts(getPagedArticlesParams(community, searchParams))
}

export const getPagedChangelogs = async (community: string): Promise<TPagedChangelogs | null> => {
  'use cache'
  cacheLife('minutes')
  cacheTag(CACHE_TAG.articlesCache(community, THREAD.CHANGELOG))

  const response = await gqFetch(P.pagedChangelogs, {
    filter: { community, page: 1 },
    userHasLogin: false,
  })

  const { data, errors } = await response.json()

  if (errors) {
    console.log('## error details', errors)
    return null
  }

  return data.pagedChangelogs
}

type TGroupedKanbanPosts = {
  backlog: TPagedPosts
  todo: TPagedPosts
  wip: TPagedPosts
  done: TPagedPosts
  rejected: TPagedPosts
}

export const getGroupedKanbanPosts = async (
  community: string,
): Promise<TGroupedKanbanPosts | null> => {
  'use cache'
  cacheLife('minutes')
  cacheTag(CACHE_TAG.articlesCache(community, THREAD.KANBAN))

  const response = await gqFetch(P.groupedKanbanPosts, { community })

  const { data, errors } = await response.json()

  if (errors) {
    console.log('## error details', errors)
    return null
  }

  return data.groupedKanbanPosts
}

export const getTags = async (community: string, thread: TThread): Promise<TTag[] | []> => {
  'use cache'
  //
  cacheLife('days')
  cacheTag(CACHE_TAG.tagsCache(community, thread))

  const gqlThread = toGqlThread(thread, 'TAGS')
  if (!gqlThread) return []

  const response = await gqFetch(P.pagedCommunityTags, { filter: { community, thread: gqlThread } })

  const { data, errors } = await response.json()
  if (errors) {
    // console.log('## error in fetching', P.community)
    console.log('## error details', errors)
    return []
  }

  return data.pagedCommunityTags.entries
}

export const getPost = async (
  community: string,
  id: string,
  thread: TThread = THREAD.POST,
): Promise<TPost | null> => {
  'use cache'
  cacheLife('minutes')

  // cacheTag(CACHE_TAG.articlesCache(community, thread))
  const response = await gqFetch(P.post, {
    article: {
      innerId: id,
      community,
      thread: toGqlThread(thread) || thread.toUpperCase(),
    },
    userHasLogin: false,
  })

  const { data, errors } = await response.json()

  if (errors) {
    // console.log('## error in fetching', P.community)
    console.log('## error details', errors)
    return null
  }

  return data.post
}

export const getChangelog = async (community: string, id: string): Promise<TPost | null> => {
  'use cache'
  cacheLife('minutes')

  // cacheTag(CACHE_TAG.articlesCache(community, THREAD.CHANGELOG))
  const response = await gqFetch(P.changelog, {
    article: {
      innerId: id,
      community,
      thread: toGqlThread(THREAD.CHANGELOG) || THREAD.CHANGELOG.toUpperCase(),
    },
    userHasLogin: false,
  })

  const { data, errors } = await response.json()

  if (errors) {
    // console.log('## error in fetching', P.community)
    console.log('## error details', errors)
    return null
  }

  return data.changelog
}

export const getPagedComments = async (
  community: string,
  id: string,
  page = 1,
  thread: TThread = THREAD.POST,
): Promise<TPagedComments | null> => {
  'use cache'
  cacheLife('minutes')

  const response = await gqFetch(P.pagedComments, {
    article: {
      innerId: id,
      community,
      thread: toGqlThread(thread) || thread.toUpperCase(),
    },
    mode: 'REPLIES',
    filter: { page, size: 30 },
  })

  const { data, errors } = await response.json()

  if (errors) {
    console.log('## error details', errors)
    return null
  }

  return data.pagedComments
}
