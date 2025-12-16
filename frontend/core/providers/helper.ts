import { cacheLife, cacheTag } from 'next/cache'
import { includes, isEmpty, mergeRight, reject, values } from 'ramda'
import { CACHE_TAG } from '~/const/cache'
import { LOCALE } from '~/const/i18n'
import METRIC from '~/const/metric'
import { HOME_COMMUNITY } from '~/const/name'
import { ROUTE } from '~/const/route'
import { ARTICLE_THREAD, THREAD } from '~/const/thread'
import URL_PARAM from '~/const/url_param'
import { loadLocaleFile } from '~/i18n'
import { P } from '~/schemas'
import type { TCommunityInfo, TMetric, TPagedArticles, TTag, TThread, TUrlInfo } from '~/spec'
import type { TRootStoreInit } from '~/stores/spec'
import { gqFetch } from '~/utils/api'
import { extractQueryName } from '~/utils/graphql'
import { parseDashboard, parseWallpaper } from '~/utils/ssr'
import { nilOrEmpty } from '~/validator'

export const ARTICLES_FILTER = {
  community: HOME_COMMUNITY.slug,
  page: 1,
  size: 20,
}

export const getArticlesParams = (community: string, urlInfo: TUrlInfo) => {
  const { searchParams } = urlInfo

  const filter = reject(nilOrEmpty)({
    community,
    page: Number(searchParams?.[URL_PARAM.PAGE]) || 1,
    // page: Number(searchParams.get(URL_PARAM.PAGE)) || 1,
    // articleTag: searchParams.get(URL_PARAM.TAG),
    // cat: searchParams.get(URL_PARAM.CAT),
    // state: searchParams.get(URL_PARAM.STATE),
    // order: searchParams.get(URL_PARAM.ORDER),
  })

  return mergeRight(ARTICLES_FILTER, filter)
}

export const getCommunity = async (
  community: string,
  pathname: string,
): Promise<TCommunityInfo> => {
  'use cache'
  cacheLife('days')
  cacheTag(CACHE_TAG.communityCache(community))

  const response = await gqFetch(P.community, { slug: community, userHasLogin: false })

  const { data, errors } = await response.json()

  if (errors) {
    // console.log('## error in fetching', P.community)
    console.log('## error details', errors)
    return {
      community: { slug: '' },
    }
  }

  return {
    community: data.community,
    dashboard: parseDashboard(data.community, pathname),
    wallpaper: parseWallpaper(data.community),
  }
}

export const getTags = async (community: string, thread: TThread): Promise<TTag[] | []> => {
  'use cache'
  //
  cacheLife('days')
  cacheTag(CACHE_TAG.tagsCache(community, thread))

  if (!hasArticles(thread)) return []

  const response = await gqFetch(P.pagedArticleTags, { community, thread })

  const { data, errors } = await response.json()
  if (errors) {
    // console.log('## error in fetching', P.community)
    console.log('## error details', errors)
    return []
  }

  return data.pagedArticleTags.entries
}

/**
 * Extract par:
 * /:community/:thread
 * /:community/:thread/:id
 *
 * community: string (any)
 * thread: ARTICLE_THREAD | THREAD.DASHBOARD | others in future
 * id: optional
 */
const parsePath = (pathname: string) => {
  const segments = pathname.split('/').filter(Boolean)

  const community = segments[0] || null
  const thread = segments[1] || null
  const id = segments[2] || null

  return { community, thread, id }
}

export const useMetric = async (pathname: string): Promise<TMetric> => {
  // --- Step 0: Special Routes ---
  if (pathname === ROUTE.APPLY_COMMUNITY) {
    return METRIC.APPLY_COMMUNITY
  }

  // --- Step 1: Parse path ---
  const { thread, id } = parsePath(pathname)

  // --- Step 2: If thread is dashboard ---
  if (thread === THREAD.DASHBOARD) {
    return METRIC.DASHBOARD
  }

  // --- Step 3: Article case ---
  if (thread && includes(thread, values(ARTICLE_THREAD)) && id) {
    return METRIC.ARTICLE
  }

  return METRIC.COMMUNITY
}

export const parseRouteInfo = (info: string): TUrlInfo => {
  const parsed = JSON.parse(info)

  return { pathname: parsed.pathname, searchParams: new URLSearchParams(parsed.search) }
}

const getPathSegment = (urlString: string, position: number): string | null => {
  try {
    const url = new URL(urlString, 'http://groupher.com')
    const segments = url.pathname.split('/').filter((segment) => segment !== '')
    return segments[position] || null
  } catch (e) {
    console.error('Invalid URL:', e)
    return null
  }
}

export const getCommunityInfo = async (community$: string): Promise<TCommunityInfo> => {
  const communityInfo = await getCommunity(community$, '/home/post')

  const { community, dashboard, wallpaper } = communityInfo
  // console.log('## pagedArticles got in server: ', pagedArticles)

  const initState = {
    community,
    wallpaper,
    dashboard,
  }

  return initState
}

export const getSSRInitData = async (urlInfo: TUrlInfo): Promise<TRootStoreInit> => {
  const { pathname } = urlInfo
  const community$ = getPathSegment(pathname, 0)
  const thread$ = getPathSegment(pathname, 1) as TThread

  const metric = await useMetric(pathname)

  const { schema } = getPagedQuery(community$, thread$)

  const locale = LOCALE.EN
  // const community = await getCommunity(community$)
  const [communityInfo, pagedArticles, tags, localeData] = await Promise.all([
    getCommunity(community$, pathname),
    getPagedArticles(community$, thread$),
    getTags(community$, thread$),
    loadLocaleFile(LOCALE.EN),
  ])

  const { community, dashboard, wallpaper } = communityInfo
  // console.log('## pagedArticles got in server: ', pagedArticles)

  const initState = {
    locale,
    localeData: JSON.stringify(localeData),
    articles: {},
    viewing: {
      metric,
      community,
      tags: [],
      activeThread: thread$,
    },
    wallpaper,
    dashboard,
  }

  if (pagedArticles !== null) {
    initState.articles[extractQueryName(schema)] = pagedArticles
  }

  if (!isEmpty(tags)) {
    initState.viewing.tags = tags
  }

  return initState
}

const getPagedQuery = (community: string, thread: TThread) => {
  const filter = { community, page: 1 }

  switch (thread) {
    case THREAD.CHANGELOG: {
      return { schema: P.pagedChangelogs, variables: { filter, userHasLogin: false } }
    }
    // P.groupedKanbanPosts

    default: {
      return { schema: P.pagedPosts, variables: { filter, userHasLogin: false } }
    }
  }
}

/**
 * check if thread has articles, some thread like about has no articles/tags to fetch
 */
const hasArticles = (thread: TThread) => {
  return [THREAD.POST, THREAD.CHANGELOG].includes(thread)
}

const getPagedArticles = async (
  community: string,
  thread: TThread,
): Promise<TPagedArticles | null> => {
  'use cache'
  cacheLife('minutes')
  cacheTag(CACHE_TAG.articlesCache(community, thread))

  if (!hasArticles(thread)) return null

  const { schema, variables } = getPagedQuery(community, thread)
  const response = await gqFetch(schema, variables)

  const { data, errors } = await response.json()

  if (errors) {
    // console.log('## error in fetching', P.community)
    console.log('## error details', errors)
    return null
  }

  return data[extractQueryName(schema)]
}
