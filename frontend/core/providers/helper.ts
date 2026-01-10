import { cacheLife, cacheTag } from 'next/cache'
import { includes, mergeRight, reject, values } from 'ramda'
import { CACHE_TAG } from '~/const/cache'
import METRIC from '~/const/metric'
import { HOME_COMMUNITY } from '~/const/name'
import { ROUTE } from '~/const/route'
import { ARTICLE_THREAD, THREAD } from '~/const/thread'
import URL_PARAM from '~/const/url_param'
import { P } from '~/schemas'
import type { TCommunityInfo, TMetric, TTag, TThread, TUrlInfo } from '~/spec'
import { gqFetch } from '~/utils/api'
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

export const getCommunity = async (community: string): Promise<TCommunityInfo> => {
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
    dashboard: parseDashboard(data.community),
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

export const getCommunityInfo = async (community$: string): Promise<TCommunityInfo> => {
  const communityInfo = await getCommunity(community$)

  const { community, dashboard, wallpaper } = communityInfo
  // console.log('## pagedArticles got in server: ', pagedArticles)

  const initState = {
    community,
    wallpaper,
    dashboard,
  }

  return initState
}

/**
 * check if thread has articles, some thread like about has no articles/tags to fetch
 */
const hasArticles = (thread: TThread) => {
  // @ts-expect-error
  return [THREAD.POST, THREAD.CHANGELOG].includes(thread)
}
