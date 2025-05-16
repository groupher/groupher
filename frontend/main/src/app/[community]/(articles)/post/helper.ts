import { reject, includes, isEmpty } from 'ramda'

import type {
  TCommunity,
  TDashboard,
  TNameAlias,
  TDashboardPath,
  TDashboardBaseInfoRoute,
  TDashboardSEORoute,
  TDashboardDocRoute,
  TDashboardBroadcastRoute,
  TDashboardLayoutRoute,
  TDashboardAliasRoute,
  TWallpaperData,
  TThemeName,
} from '~/spec'

import { BUILDIN_ALIAS } from '~/const/name'
import THEME from '~/const/theme'
// import METRIC from '~/const/metric'
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

export type TParseDashboard = TDashboard & {
  original: TDashboard
}

export type TDashboardTab = {
  curTab: TDashboardPath
  baseInfoTab?: TDashboardBaseInfoRoute
  seoTab?: TDashboardSEORoute
  docTab?: TDashboardDocRoute
  broadcastTab?: TDashboardBroadcastRoute
  layoutTab?: TDashboardLayoutRoute
  aliasTab?: TDashboardAliasRoute
}

export type TParsedWallpaper = TWallpaperData & {
  initWallpaper: TWallpaperData
}

const parseDashboardAlias = (nameAlias: TNameAlias[]): TNameAlias[] => {
  const changedAliasKeys = nameAlias.map((item) => item.original)
  const unChangedAlias = reject(
    (item: TNameAlias) => includes(item.original, changedAliasKeys),
    BUILDIN_ALIAS,
  )

  return reject((item: TNameAlias) => item.slug === '', [...nameAlias, ...unChangedAlias])
}

/** only for dashboard sub pages */
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

export const parseDashboard2 = (community: TCommunity, pathname: string): TParseDashboard => {
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

export const parseDashboard = (community: TCommunity): TDashboard => {
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

  return removeEmptyValuesFromObject({
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
}

export const parseThemeFromURL = (searchParams): TThemeName => {
  return searchParams?.theme === THEME.DARK ? THEME.DARK : THEME.LIGHT
}

export const parseWallpaper2 = (community: TCommunity): TParsedWallpaper => {
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

export const parseWallpaper = (community: TCommunity): TWallpaperData => {
  // NOTE: if the backend is not ready, return default config
  // @ts-ignore
  if (!community) return {}

  const { dashboard } = community
  const { wallpaper } = dashboard

  return wallpaper
}
