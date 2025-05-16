'use server'

import { reject, mergeRight } from 'ramda'

import type { TThread, TPagedPosts, TCommunity, TTag, TUrlInfo, TThemeName, TMetric } from '~/spec'
import type { TRootStoreInit } from '~/stores/spec'
import { nilOrEmpty } from '~/validator'
import URL_PARAM from '~/const/url_param'
import { HCN } from '~/const/name'
import THEME from '~/const/theme'
import METRIC from '~/const/metric'
import { EMPTY_PAGED_ARTICLES } from '~/const/utils'

import { P } from '~/schemas'
import { GRAPHQL_ENDPOINT } from '~/config'
import { parseDashboard, parseWallpaper } from '~/utils/ssr/helper3'

import { unstable_cache } from 'next/cache'

const _gqFetchRaw = async (query: string, variables?: Record<string, any>) => {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  return res.json()
}

// 支持 Server Action 的缓存版本
export const gqFetch = async (
  query: string,
  variables?: Record<string, any>,
  options?: {
    revalidate?: number | false
    tags?: string[]
  },
) => {
  // 必须添加 async 关键字
  return unstable_cache(
    async () => _gqFetchRaw(query, variables),
    [`graphql-${query}-${JSON.stringify(variables)}`],
    {
      revalidate: options?.revalidate ?? 60,
      tags: options?.tags,
    },
  )()
}

export const gqFetch2 = async (query, variables, revalidate = 60) => {
  return await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
    next: {
      revalidate,
    },
  })
}

const ARTICLES_FILTER = {
  community: HCN,
  page: 1,
  size: 20,
}

const getArticlesParams = (community: string, urlInfo: TUrlInfo) => {
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

export const getPagedPosts = async (community: string, urlInfo: TUrlInfo): Promise<TPagedPosts> => {
  // const variables = { filter, userHasLogin: false },
  const filter = getArticlesParams(community, urlInfo)

  const response = await gqFetch(P.pagedPosts, { filter, userHasLogin: false })

  const { data, errors } = await response.json()

  if (errors) {
    // console.log('## error in fetching', P.community)
    console.log('## error details', errors)
  }

  return data.pagedPosts
}

const extractQueryName = (gqSchema: string): string | null => {
  const regex = /query\s+(\w+)\s*(?:\(|\{)/
  const match = gqSchema.match(regex)
  return match ? match[1] : null
}

export const getPagedArticles = async (schema: string, filter): Promise<TPagedPosts> => {
  // const variables = { filter, userHasLogin: false },
  const response = await gqFetch(schema, { filter, userHasLogin: false })

  const { data, errors } = await response

  if (errors) {
    console.log('## error details', errors)
    return EMPTY_PAGED_ARTICLES
  }
  const queryKey = extractQueryName(schema)

  return data[queryKey]
}

export const getCommunity = async (community: string): Promise<TCommunity> => {
  const response = await gqFetch(P.community, { slug: community, userHasLogin: false })

  const { data, errors } = await response.json()

  if (errors) {
    // console.log('## error in fetching', P.community)
    console.log('## error details', errors)
    return { slug: '' }
  }

  return data.community
}

export const getTags = async (community: string, thread: TThread): Promise<TTag[]> => {
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

const useThemeFromURL = (searchParams: URLSearchParams): TThemeName => {
  const theme = searchParams.get('theme')

  if (theme === THEME.DARK) {
    return THEME.DARK
  }

  return THEME.LIGHT
}

export const useMetric = async (pathname): Promise<TMetric> => {
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

export const getSSRInitData = async (urlInfo: TUrlInfo): Promise<TRootStoreInit> => {
  const { pathname, searchParams } = urlInfo
  const community$ = 'home'
  const thread$ = 'post'

  const theme = useThemeFromURL(searchParams)
  const metric = await useMetric(pathname)

  const [community, pagedArticles, tags] = await Promise.all([
    getCommunity(community$),
    getPagedPosts(community$, urlInfo),
    getTags(community$, thread$),
  ])

  const dashboard = parseDashboard(community, pathname)
  const wallpaper = parseWallpaper(community)

  return {
    theme,
    // locale,
    // localeData,
    articles: {
      pagedPosts: pagedArticles,
      // pagedChangelogs,
    },
    viewing: {
      metric,
      community,
      tags,
      activeThread: 'post',
    },
    wallpaper,
    dashboard,
  }
}
