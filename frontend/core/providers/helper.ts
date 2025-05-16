import { reject, mergeRight, isEmpty } from 'ramda'
import { unstable_cacheLife as cacheLife, unstable_cacheTag as cacheTag } from 'next/cache'

import type {
  TThread,
  TPagedArticles,
  TCommunityInfo,
  TTag,
  TUrlInfo,
  TThemeName,
  TMetric,
} from '~/spec'
import type { TRootStoreInit } from '~/stores/spec'
import { nilOrEmpty } from '~/validator'
import { CACHE_TAG } from '~/const/cache'
import URL_PARAM from '~/const/url_param'
import { HCN } from '~/const/name'
import { THREAD } from '~/const/thread'
import THEME from '~/const/theme'
import METRIC from '~/const/metric'

import { P } from '~/schemas'
import { GRAPHQL_ENDPOINT } from '~/config'
import { parseWallpaper, parseDashboard } from '~/utils/ssr/helper'
import { extractQueryName } from '~/utils/graphql'

export const gqFetch = async (query, variables) => {
  return await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  })
}

export const ARTICLES_FILTER = {
  community: HCN,
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

// type TServerPostsPage = [community: TCommunity, pagedPosts: TPagedPosts, tags: TTag[]]

const useThemeFromURL = async (searchParams: URLSearchParams): Promise<TThemeName> => {
  // 'use cache'
  // const theme = searchParams?.get('theme')

  // if (theme === THEME.DARK) {
  //   return THEME.DARK
  // }

  return THEME.LIGHT
}

export const useMetric = async (pathname): Promise<TMetric> => {
  // 'use cache'
  // const thread = parseThread(pathname)
  // const articleParams = useArticleParams()

  // if (includes(thread, values(ARTICLE_THREAD)) && articleParams.id) {
  //   return METRIC.ARTICLE
  // }

  // if (ROUTE.APPLY_COMMUNITY === pathname) {
  //   return METRIC.APPLY_COMMUNITY
  // }

  // if (thread === THREAD.DASHBOARD) {
  //   return METRIC.DASHBOARD
  // }

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

export const getSSRInitData = async (urlInfo: TUrlInfo): Promise<TRootStoreInit> => {
  const { pathname, searchParams } = urlInfo
  const community$ = getPathSegment(pathname, 0)
  const thread$ = getPathSegment(pathname, 1) as TThread

  const theme = await useThemeFromURL(searchParams)
  const metric = await useMetric(pathname)

  const { schema } = getPagedQuery(community$, thread$)

  // const community = await getCommunity(community$)
  const [communityInfo, pagedArticles, tags] = await Promise.all([
    getCommunity(community$, pathname),
    getPagedArticles(community$, thread$),
    getTags(community$, thread$),
  ])

  const { community, dashboard, wallpaper } = communityInfo
  // console.log('## pagedArticles got in server: ', pagedArticles)

  const initState = {
    theme,
    // locale,
    // localeData,
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

export const getSSRLandingData = async (): Promise<TRootStoreInit> => {
  const community$ = 'home'

  // const community = await getCommunity(community$)
  const communityInfo = await getCommunity(community$, '/')

  const { community, dashboard, wallpaper } = communityInfo
  // console.log('## pagedArticles got in server: ', pagedArticles)

  const initState = {
    theme: THEME.LIGHT,
    // locale,
    // localeData,
    articles: {},
    viewing: {
      metric: METRIC.COMMUNITY,
      community,
    },
    wallpaper,
    dashboard,
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
