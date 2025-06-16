import { unstable_cacheLife as cacheLife, unstable_cacheTag as cacheTag } from 'next/cache'
import { reject, includes, isEmpty } from 'ramda'

import { CACHE_TAG } from '~/const/cache'

import type {
  TCommunity,
  TThread,
  TNameAlias,
  TDashboardPath,
  TDashboardBaseInfoRoute,
  TDashboardSEORoute,
  TDashboardDocRoute,
  TDashboardBroadcastRoute,
  TDashboardLayoutRoute,
  TDashboardAliasRoute,
  TParsedWallpaper,
  TParseDashboard,
  TPagedArticles,
  TPagedTags,
} from '~/spec'

import { BUILDIN_ALIAS } from '~/const/name'
import { PAGE_COLOR_DEFAULT } from '~/const/colors'
import { THREAD } from '~/const/thread'
import {
  DASHBOARD_ROUTE,
  DASHBOARD_BASEINFO_ROUTE,
  DASHBOARD_SEO_ROUTE,
  DASHBOARD_DOC_ROUTE,
  DASHBOARD_BROADCAST_ROUTE,
  DASHBOARD_LAYOUT_ROUTE,
  DASHBOARD_ALIAS_ROUTE,
} from '~/const/route'
import { removeEmptyValuesFromObject } from '~/helper'

import { P } from '~/schemas'
import { extractQueryName } from '~/utils/graphql'
import { gqFetch } from '~/utils/api'

import type { TGQSSRResult, TDashboardTab } from './spec'

export const commonRes = (result): TGQSSRResult => {
  return {
    fetching: result.fetching,
    error: result.error,
    stale: result.stale,
  }
}

/**
 * common url filter logic for all paged articles queries
 */
// export const usePagedArticlesParams = (searchParams: URLSearchParams): TPagedArticlesParams => {
//   const community = 'home'

//   const filter = reject(nilOrEmpty)({
//     community,
//     page: Number(searchParams.get(URL_PARAM.PAGE)) || 1,
//     size: 20,
//     articleTag: searchParams.get(URL_PARAM.TAG),
//     cat: searchParams.get(URL_PARAM.CAT),
//     state: searchParams.get(URL_PARAM.STATE),
//     order: searchParams.get(URL_PARAM.ORDER),
//   }) as TPagedArticlesParams

//   return mergeRight(ARTICLES_FILTER, filter)
// }

export const parseWallpaper = (community: TCommunity): TParsedWallpaper => {
  // NOTE: if the backend is not ready, return default config
  // @ts-ignore
  if (!community) return {}

  const { dashboard } = community
  const { wallpaper } = dashboard

  return {
    ...wallpaper,
    initWallpaper: {
      ...wallpaper,
    },
  }
}

const parseDashboardAlias = (nameAlias: TNameAlias[]): TNameAlias[] => {
  const changedAliasKeys = nameAlias.map((item) => item.original)
  const unChangedAlias = reject(
    (item: TNameAlias) => includes(item.original, changedAliasKeys),
    BUILDIN_ALIAS,
  )

  return reject((item: TNameAlias) => item.slug === '', [...nameAlias, ...unChangedAlias])
}

/**
 * parse the dashboard's cutTab & sub tab from pathname
 */
const parseDashboardThread = (pathname: string): TDashboardTab => {
  const segments = reject(isEmpty, pathname.split('/'))
  const isOverviewThread = segments.length === 2

  if (segments[1] !== THREAD.DASHBOARD) {
    return { curTab: DASHBOARD_ROUTE.OVERVIEW }
  }

  if (segments[1] === THREAD.DASHBOARD && isOverviewThread) {
    return {
      curTab: DASHBOARD_ROUTE.OVERVIEW as TDashboardPath,
    }
  }

  const dashThread = segments[2]
  const dashLeaf = segments[3]

  switch (dashThread) {
    case DASHBOARD_ROUTE.INFO: {
      return {
        curTab: DASHBOARD_ROUTE.INFO as TDashboardPath,
        baseInfoTab: (dashLeaf || DASHBOARD_BASEINFO_ROUTE.BASIC) as TDashboardBaseInfoRoute,
      }
    }

    case DASHBOARD_ROUTE.SEO: {
      return {
        curTab: DASHBOARD_ROUTE.SEO as TDashboardPath,
        seoTab: (dashLeaf || DASHBOARD_SEO_ROUTE.SEARCH_ENGINE) as TDashboardSEORoute,
      }
    }

    case DASHBOARD_ROUTE.DOC: {
      return {
        curTab: DASHBOARD_ROUTE.DOC as TDashboardPath,
        docTab: (dashLeaf || DASHBOARD_DOC_ROUTE.TABLE) as TDashboardDocRoute,
      }
    }

    case DASHBOARD_ROUTE.BROADCAST: {
      return {
        curTab: DASHBOARD_ROUTE.BROADCAST as TDashboardPath,
        broadcastTab: (dashLeaf || DASHBOARD_BROADCAST_ROUTE.GLOBAL) as TDashboardBroadcastRoute,
      }
    }

    case DASHBOARD_ROUTE.ALIAS: {
      return {
        curTab: DASHBOARD_ROUTE.ALIAS,
        aliasTab: (dashLeaf || DASHBOARD_ALIAS_ROUTE.THREAD) as TDashboardAliasRoute,
      }
    }

    case DASHBOARD_ROUTE.LAYOUT: {
      return {
        curTab: DASHBOARD_ROUTE.LAYOUT,
        layoutTab: (dashLeaf || DASHBOARD_LAYOUT_ROUTE.GENERAL) as TDashboardLayoutRoute,
      }
    }

    default: {
      return {
        curTab: dashThread as TDashboardPath,
      }
    }
  }
}

export const parseDashboard = (community: TCommunity, pathname: string): TParseDashboard => {
  // NOTE: if the backend is not ready, return default config
  // @ts-ignore
  if (!community) return {}

  const { dashboard, moderators } = community

  const {
    enable,
    nameAlias,
    socialLinks,
    faqs,
    seo,
    layout,
    rss,
    baseInfo,
    headerLinks,
    footerLinks,
    mediaReports,
    pageBg,
    pageBgDark,
  } = dashboard

  const fieldsObj = removeEmptyValuesFromObject({
    enable,
    nameAlias: parseDashboardAlias(nameAlias),
    socialLinks,
    faqSections: faqs,
    ...baseInfo,
    ...seo,
    ...layout,
    ...rss,
    headerLinks,
    footerLinks,
    moderators,
    mediaReports,
    pageBg: pageBg || PAGE_COLOR_DEFAULT.light,
    pageBgDark: pageBgDark || PAGE_COLOR_DEFAULT.dark,
  })

  return {
    ...fieldsObj,
    original: {
      ...fieldsObj,
    },
    ...parseDashboardThread(pathname),
  }
}

// used in server/api

const hasArticles = (thread: TThread) => {
  return [THREAD.POST, THREAD.CHANGELOG].includes(thread)
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

export const getPagedArticles = async (
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

export const getPagedTags = async (
  community: string,
  thread: TThread,
): Promise<TPagedTags | null> => {
  'use cache'
  cacheLife('hours')
  cacheTag(CACHE_TAG.tagsCache(community, thread))

  //  if (!hasArticles(thread)) return null

  const response = await gqFetch(P.pagedArticleTags, { community, thread })
  console.log('## got response: ', response)

  const { data, errors } = await response.json()

  if (errors) {
    console.log('## error details', errors)
    return null
  }

  return data[extractQueryName(P.pagedArticleTags)]
}
