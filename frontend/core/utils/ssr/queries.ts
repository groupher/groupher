/**
 * for result returned by urql, ref:
 * https://formidable.com/open-source/urql/docs/api/urql/#usequery
 * https://formidable.com/open-source/urql/docs/api/core/#operationresult
 */

import { useMemo } from 'react'
import { values, includes } from 'ramda'

import { useQuery } from '@urql/next'
import { usePathname } from 'next/navigation'

// import LangParser from 'accept-language-parser'

import type { TCommunity, TMetric, TThemeName, TParsedWallpaper, TParseDashboard } from '~/spec'
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
  TFilterSearchParams,
  TUseI18n,
} from './spec'

import {
  commonRes,
  usePathCheck,
  usePagedArticlesParams,
  useArticleParams,
  useCommunityParam,
  useThreadParam,
  //
  parseWallpaper,
  parseDashboard,
} from './helper'

export { parseCommunity, useThreadParam } from './helper'

export const useThemeFromURL = (): TThemeName => {
  return THEME.LIGHT

  // const searchParams = useSearchParams()
  // const theme = searchParams.get('theme')

  // return useMemo(() => {
  //   if (theme === THEME.DARK) {
  //     return THEME.DARK
  //   }
  //   return THEME.LIGHT
  // }, [theme])
}

/**
 * i18n 的 workflow 比较 tricky, 为了在 SSR 阶段获取到 locale 语言包，在这里向
 * 其他 GQ API 一样发起请求，但是这里的请求是被 GraphqlClient 拦截的，不会真的去后端
 * 而是返回本地文件，这里的 locale 参数来自 query string
 */
export const useI18n = (): TUseI18n => {
  const locale = useParseLang()
  const matched = usePathCheck()
  // NOTE: put this parser into frontend maybe ?
  // const lang = LangParser.parse('zh-CN,zh;q=0.9,en;q=0.8,ja;q=0.7,it;q=0.6,fr;q=0.5,zh-TW;q=0.4')
  // console.log('## ## lang: ', lang)
  const [result] = useQuery({
    query: i18nQuery,
    // TODO: use community.locale or search lang query
    variables: { locale },
    // pause: false,
    pause: !matched,
  })

  return useMemo(() => {
    return {
      locale,
      localeData: JSON.stringify(result.data),
    }
  }, [locale, result.data])
}

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
  const matched = usePathCheck('community')

  const [result] = useQuery({
    query: P.community,
    variables: {
      slug,
      userHasLogin: false,
    },
    pause: !matched,
  })

  return {
    ...commonRes(result),
    community: result.data?.community,
  }
}

export const useTags = (): TTagsRes => {
  const community = useCommunityParam()
  const matched = usePathCheck('tags')
  const thread = useThreadParam()

  const [result] = useQuery({
    query: P.pagedArticleTags,
    variables: {
      filter: { community, thread: thread.toUpperCase() },
    },
    pause: !matched,
  })

  return {
    ...commonRes(result),
    tags: result.data?.pagedArticleTags.entries,
  }
}

export const usePagedPosts = (): TPagedPostsRes => {
  const filter = usePagedArticlesParams()
  const matched = usePathCheck('pagedPosts')

  const [result] = useQuery({
    query: P.pagedPosts,
    variables: { filter, userHasLogin: false },
    pause: !matched,
  })

  return {
    ...commonRes(result),
    pagedPosts: result.data?.pagedPosts,
  }
}

export const usePagedPosts2 = (): TPagedPostsRes => {
  const filter = {
    community: 'home',
    page: 1,
    size: 20,
  }

  const [result] = useQuery({
    query: P.pagedPosts,
    variables: { filter, userHasLogin: false },
    pause: false,
  })

  return {
    ...commonRes(result),
    pagedPosts: result.data?.pagedPosts,
  }
}

export const usePagedChangelogs = (): TPagedChangelogsRes => {
  const filter = usePagedArticlesParams()
  const matched = usePathCheck('pagedChangelogs', 'changelog')
  console.log('## usePagedChangelogs matched? ', matched)

  const [result] = useQuery({
    query: P.pagedChangelogs,
    variables: { filter, userHasLogin: false },
    pause: !matched,
  })

  return {
    ...commonRes(result),
    pagedChangelogs: result.data?.pagedChangelogs,
  }
}

export const usePost = (): TPostRes => {
  const { community, id } = useArticleParams()
  const matched = usePathCheck('post')

  const [result] = useQuery({
    query: P.post,
    variables: { community, id, userHasLogin: false },
    pause: !matched,
  })

  return {
    ...commonRes(result),
    post: result.data?.post,
  }
}

export const useChangelog = (): TChangelogRes => {
  const { community, id } = useArticleParams()
  const matched = usePathCheck('changelog')

  const [result] = useQuery({
    query: P.changelog,
    variables: { community, id, userHasLogin: false },
    pause: !matched,
  })

  return {
    ...commonRes(result),
    changelog: result.data?.changelog,
  }
}

export const useGroupedKanbanPosts = (): TGroupedKanbanPostsRes => {
  const community = useCommunityParam()
  const matched = usePathCheck('kanbanPosts')

  const [result] = useQuery({
    query: P.groupedKanbanPosts,
    variables: { community, userHasLogin: false },
    pause: !matched,
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
  const matched = usePathCheck()

  // @ts-ignore
  return matched ? parseWallpaper(community) : {}
}

export const useDashboard = (community: TCommunity): TParseDashboard => {
  const matched = usePathCheck()
  const pathname = usePathname()

  // @ts-ignore
  return matched ? parseDashboard(community, pathname) : {}
}

/**
 * parse cat & state from url search params
 * used for sync state in articles filter bar
 */

export const useFilterSearchParams = (): TFilterSearchParams => {
  const searchParams = new Map() // useSearchParams()

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
