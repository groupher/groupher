import { cacheLife, cacheTag } from 'next/cache'
import { includes, isEmpty, reject } from 'ramda'

import { CACHE_TAG } from '~/const/cache'
import { PAGE_BG_DEFAULT } from '~/const/colors'
import { BUILTIN_ALIAS } from '~/const/name'
import {
  DSB_ALIAS_ROUTE,
  DSB_BASEINFO_ROUTE,
  DSB_BROADCAST_ROUTE,
  DSB_DOC_ROUTE,
  DSB_LAYOUT_ROUTE,
  DSB_ROUTE,
  DSB_SEO_ROUTE,
} from '~/const/route'
import THEME from '~/const/theme'
import { THREAD } from '~/const/thread'
import { removeEmptyValuesFromObject } from '~/helper'
import { P } from '~/schemas'
import type {
  TCommunity,
  TDsbAliasRoute,
  TDsbBaseInfoRoute,
  TDsbBroadcastRoute,
  TDsbDocRoute,
  TDsbLayoutRoute,
  TDsbPath,
  TDsbSEORoute,
  TNameAlias,
  TPagedArticles,
  TPagedTags,
  TParseDashboard,
  TParsedWallpaper,
  TThread,
} from '~/spec'
import { gqFetch } from '~/utils/api'
import { extractQueryName } from '~/utils/graphql'

import type { TDsbTab, TGQSSRResult } from './spec'

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
  // @ts-expect-error
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
    BUILTIN_ALIAS,
  )

  return reject((item: TNameAlias) => item.slug === '', [...nameAlias, ...unChangedAlias])
}

/**
 * parse the dashboard's cutTab & sub tab from pathname
 */
const parseDashboardThread = (pathname: string): TDsbTab => {
  const segments = reject(isEmpty, pathname.split('/'))
  const isOverviewThread = segments.length === 2

  if (segments[1] !== THREAD.DASHBOARD) {
    return { curTab: DSB_ROUTE.OVERVIEW }
  }

  if (segments[1] === THREAD.DASHBOARD && isOverviewThread) {
    return {
      curTab: DSB_ROUTE.OVERVIEW as TDsbPath,
    }
  }

  const dashThread = segments[2]
  const dashLeaf = segments[3]

  switch (dashThread) {
    case DSB_ROUTE.INFO: {
      return {
        curTab: DSB_ROUTE.INFO as TDsbPath,
        baseInfoTab: (dashLeaf || DSB_BASEINFO_ROUTE.BASIC) as TDsbBaseInfoRoute,
      }
    }

    case DSB_ROUTE.SEO: {
      return {
        curTab: DSB_ROUTE.SEO as TDsbPath,
        seoTab: (dashLeaf || DSB_SEO_ROUTE.SEARCH_ENGINE) as TDsbSEORoute,
      }
    }

    case DSB_ROUTE.DOC: {
      return {
        curTab: DSB_ROUTE.DOC as TDsbPath,
        docTab: (dashLeaf || DSB_DOC_ROUTE.TABLE) as TDsbDocRoute,
      }
    }

    case DSB_ROUTE.BROADCAST: {
      return {
        curTab: DSB_ROUTE.BROADCAST as TDsbPath,
        broadcastTab: (dashLeaf || DSB_BROADCAST_ROUTE.GLOBAL) as TDsbBroadcastRoute,
      }
    }

    case DSB_ROUTE.ALIAS: {
      return {
        curTab: DSB_ROUTE.ALIAS,
        aliasTab: (dashLeaf || DSB_ALIAS_ROUTE.THREAD) as TDsbAliasRoute,
      }
    }

    case DSB_ROUTE.LAYOUT: {
      return {
        curTab: DSB_ROUTE.LAYOUT,
        layoutTab: (dashLeaf || DSB_LAYOUT_ROUTE.GENERAL) as TDsbLayoutRoute,
      }
    }

    default: {
      return {
        curTab: dashThread as TDsbPath,
      }
    }
  }
}

export const parseDashboard = (community: TCommunity, pathname: string): TParseDashboard => {
  // NOTE: if the backend is not ready, return default config
  // @ts-expect-error
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
    nameAlias: parseDashboardAlias([...nameAlias]),
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
    pageBg: pageBg || PAGE_BG_DEFAULT[THEME.LIGHT],
    pageBgDark: pageBgDark || PAGE_BG_DEFAULT[THEME.DARK],
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

  const { data, errors } = await response.json()

  if (errors) {
    console.log('## error details', errors)
    return null
  }

  return data[extractQueryName(P.pagedArticleTags)]
}
