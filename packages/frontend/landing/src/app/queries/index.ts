/**
 * for reault returned by urql, ref:
 * https://formidable.com/open-source/urql/docs/api/urql/#usequery
 * https://formidable.com/open-source/urql/docs/api/core/#operationresult
 */

import { useMemo } from 'react'
import { values, includes } from 'ramda'

import { useQuery } from '@urql/next'
import { usePathname, useSearchParams } from 'next/navigation'

// import LangParser from 'accept-language-parser'

import type { TCommunity, TMetric, TThemeName } from '~/spec'
import { P } from '~/schemas'
import { THREAD, ARTICLE_THREAD } from '~/const/thread'
import { ROUTE } from '~/const/route'
import THEME from '~/const/theme'
import METRIC from '~/const/metric'
import URL_PARAM from '~/const/url_param'
import { ARTICLE_CAT, ARTICLE_STATE, ARTICLE_ORDER } from '~/const/gtd'
import { i18nQuery, useParseLang } from '~/i18n'

import type {
  TCommunityRes,
  TTagsRes,
  TPostRes,
  TChangelogRes,
  TPagedPostsRes,
  TGroupedKanbanPostsRes,
  TPagedChangelogsRes,
  TParsedWallpaper,
  TParseDashboard,
  TFilterSearchParams,
  TUseI18n,
} from './spec'

import {
  commonRes,
  usePagedArticlesParams,
  useArticleParams,
  useCommunityParam,
  useThreadParam,
  useIsFrameworkQuery,
  useSkipStaticQuery,
  useIdParam,
  //
  parseWallpaper,
  parseDashboard,
} from './helper'

export { parseCommunity, useThreadParam } from './helper'

export const useThemeFromURL = (): TThemeName => {
  const searchParams = useSearchParams()
  const theme = searchParams.get('theme')

  return useMemo(() => {
    if (theme === THEME.DARK) {
      return THEME.DARK
    }
    return THEME.LIGHT
  }, [theme]) // 依赖项是 theme，只有 theme 变化时才重新计算
}

/**
 * i18n 的 workflow 比较 tricky, 为了在 SSR 阶段获取到 locale 语言包，在这里向
 * 其他 GQ API 一样发起请求，但是这里的请求是被 GraphqlClient 拦截的，不会真的去后端
 * 而是返回本地文件，这里的 locale 参数来自 query string
 */
export const useI18n = (): TUseI18n => {
  const locale = useParseLang()
  const skipLandingQuery = useSkipStaticQuery()
  // const searchParams = useSearchParams()
  // console.log('## ## data: ', data)

  // NOTE: put this parser into frontend maybe ?
  // const lang = LangParser.parse('zh-CN,zh;q=0.9,en;q=0.8,ja;q=0.7,it;q=0.6,fr;q=0.5,zh-TW;q=0.4')
  // console.log('## ## lang: ', lang)

  const [result] = useQuery({
    query: i18nQuery,
    // TODO: use community.locale or search lang query
    variables: { locale },
    // pause: false,
    pause: skipLandingQuery,
  })

  return useMemo(() => {
    return {
      locale,
      localeData: JSON.stringify(result.data),
    }
  }, [locale, result.data])
}

// export const useThemeFromURL = (): TThemeName => {
//   const searchParams = useSearchParams()
//   const theme = searchParams.get('theme')
//   console.log('## ## geting theme from url')

//   if (theme === THEME.DARK) {
//     return THEME.DARK
//   }

//   return THEME.LIGHT
// }

export const useMetric = (): TMetric => {
  const pathname = usePathname()

  const thread = useThreadParam()
  const articleParams = useArticleParams()

  if (includes(thread, values(ARTICLE_THREAD)) && articleParams.id) {
    return METRIC.ARTICLE
  }

  if (ROUTE.APPLY_COMMUNITY === pathname) {
    return METRIC.APPLY_COMMUNITY
  }

  if (thread === THREAD.DASHBOARD) {
    return METRIC.DASHBOARD
  }

  return METRIC.COMMUNITY
}

export const useCommunity = (): TCommunityRes => {
  const slug = useCommunityParam()
  const skipLandingQuery = useSkipStaticQuery()

  const [result] = useQuery({
    query: P.community,
    variables: {
      slug,
      userHasLogin: false,
    },
    pause: skipLandingQuery,
  })

  return {
    ...commonRes(result),
    community: result.data?.community,
  }
}

export const useTags = (): TTagsRes => {
  const community = useCommunityParam()
  const skipLandingQuery = useSkipStaticQuery()
  const thread = useThreadParam()

  const [result] = useQuery({
    query: P.pagedArticleTags,
    variables: {
      filter: { community, thread: thread.toUpperCase() },
    },
    pause: !(!skipLandingQuery && includes(thread, values(ARTICLE_THREAD))),
  })

  return {
    ...commonRes(result),
    tags: result.data?.pagedArticleTags.entries,
  }
}

export const usePagedPosts = (): TPagedPostsRes => {
  const filter = usePagedArticlesParams()
  const thread = useThreadParam()
  const skipLandingQuery = useSkipStaticQuery()
  const id = useIdParam()

  const [result] = useQuery({
    query: P.pagedPosts,
    variables: { filter, userHasLogin: false },
    pause: !(!skipLandingQuery && thread === THREAD.POST && !id),
  })

  return {
    ...commonRes(result),
    pagedPosts: result.data?.pagedPosts,
  }
}

export const usePagedChangelogs = (): TPagedChangelogsRes => {
  const filter = usePagedArticlesParams()
  const skipLandingQuery = useSkipStaticQuery()
  const thread = useThreadParam()

  const [result] = useQuery({
    query: P.pagedChangelogs,
    variables: { filter, userHasLogin: false },
    pause: !(!skipLandingQuery && thread === THREAD.CHANGELOG),
  })

  return {
    ...commonRes(result),
    pagedChangelogs: result.data?.pagedChangelogs,
  }
}

export const usePost = (): TPostRes => {
  const { community, id } = useArticleParams()
  const skipLandingQuery = useSkipStaticQuery()
  const thread = useThreadParam()

  const [result] = useQuery({
    query: P.post,
    variables: { community, id, userHasLogin: false },
    pause: !(!skipLandingQuery && thread === THREAD.POST && id),
  })

  return {
    ...commonRes(result),
    post: result.data?.post,
  }
}

export const useChangelog = (): TChangelogRes => {
  const { community, id } = useArticleParams()
  const skipLandingQuery = useSkipStaticQuery()
  const thread = useThreadParam()

  const [result] = useQuery({
    query: P.changelog,
    variables: { community, id, userHasLogin: false },
    pause: !(!skipLandingQuery && thread === THREAD.CHANGELOG && id),
  })

  return {
    ...commonRes(result),
    changelog: result.data?.changelog,
  }
}

export const useGroupedKanbanPosts = (): TGroupedKanbanPostsRes => {
  const community = useCommunityParam()
  const skipLandingQuery = useSkipStaticQuery()
  const thread = useThreadParam()

  const [result] = useQuery({
    query: P.groupedKanbanPosts,
    variables: { community, userHasLogin: false },
    pause: !(!skipLandingQuery && thread === THREAD.KANBAN),
  })

  return {
    ...commonRes(result),
    groupedKanbanPosts: result.data?.groupedKanbanPosts,
  }
}

/**
 * wallpaper related settings for all page
 */
export const useWallpaper = (community: TCommunity): TParsedWallpaper => {
  const isStaticQuery = useIsFrameworkQuery()

  // @ts-ignore
  return !isStaticQuery ? parseWallpaper(community) : {}
}

/**
 * general dashboard settings for all page
 */
// export const useDashboard = (community: TCommunity): TParseDashboard => {
//   const isStaticQuery = useIsFrameworkQuery()
//   const pathname = usePathname()

//   // @ts-ignore
//   if (isStaticQuery || !community) return {}

//   return parseDashboard(community, pathname)
// }

export const useDashboard = (community: TCommunity): TParseDashboard => {
  const isStaticQuery = useIsFrameworkQuery()
  const pathname = usePathname()

  return useMemo(() => {
    // 如果是静态查询或者 community 不存在，直接返回空对象
    if (isStaticQuery || !community) return {}

    return parseDashboard(community, pathname)
  }, [community, isStaticQuery, pathname]) as TParseDashboard // 当这些值变化时，才重新计算结果
}

/**
 * parse cat & state from url search params
 * used for sync state in articles filter bar
 */

export const useFilterSearchParams = (): TFilterSearchParams => {
  const searchParams = useSearchParams()

  return useMemo(() => {
    const filter = {
      activeCat: null,
      activeState: null,
      activeOrder: null,
    }

    const cat = searchParams.get(URL_PARAM.CAT)?.toUpperCase()
    const state = searchParams.get(URL_PARAM.STATE)?.toUpperCase()
    const order = searchParams.get(URL_PARAM.ORDER)?.toUpperCase()

    if (includes(cat, values(ARTICLE_CAT))) filter.activeCat = cat
    if (includes(state, values(ARTICLE_STATE))) filter.activeState = state
    if (includes(order, values(ARTICLE_ORDER))) filter.activeOrder = order

    return filter
  }, [searchParams]) // useMemo依赖于searchParams对象
}

// export const useFilterSearchParams = (): TFilterSearchParams => {
//   const searchParams = useSearchParams()
//   const filter = {
//     activeCat: null,
//     activeState: null,
//     activeOrder: null,
//   }

//   const cat = searchParams.get(URL_PARAM.CAT)?.toUpperCase()
//   const state = searchParams.get(URL_PARAM.STATE)?.toUpperCase()
//   const order = searchParams.get(URL_PARAM.ORDER)?.toUpperCase()

//   if (includes(cat, values(ARTICLE_CAT))) filter.activeCat = cat
//   if (includes(state, values(ARTICLE_STATE))) filter.activeState = state
//   if (includes(order, values(ARTICLE_ORDER))) filter.activeOrder = order

//   return filter
// }
