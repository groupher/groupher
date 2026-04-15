import type { FC, ReactNode } from 'react'

import METRIC from '~/const/metric'
import { COMMUNITY_THREADS } from '~/const/thread'

import type { TCommunity, TLocale, TMetric } from '~/spec'
import ArticleListStoreProvider from '~/stores/articleList/provider'
import type { TInit as TArticleListInit } from '~/stores/articleList/spec'
import CommunityStoreProvider from '~/stores/community/provider'
import DashboardStoreProvider from '~/stores/dashboard/provider'
import type { TInit as TDashboardInit } from '~/stores/dashboard/spec'
import LocaleStoreProvider from '~/stores/locale/provider'
import ThemeStoreProvider from '~/stores/theme/provider'
import WallpaperStoreProvider from '~/stores/wallpaper/provider'
import type { TInit as TWallpaperInit } from '~/stores/wallpaper/spec'

export type TWrapperOpts = {
  metric?: TMetric
  now?: number
  locale?: TLocale
  localeData?: string
  community?: Partial<Omit<TCommunity, 'slug'>> & { slug?: string }
  dashboard?: Partial<Omit<TDashboardInit, 'now' | 'metric'>>
  wallpaper?: TWallpaperInit
  articleList?: boolean
  articleListInit?: TArticleListInit
}

export const makeStoreWrapper = (opts: TWrapperOpts = {}): FC<{ children: ReactNode }> => {
  const {
    metric = METRIC.COMMUNITY,
    now = 1,
    locale = 'en',
    localeData = '{}',
    community = {},
    dashboard = {},
    wallpaper = {},
    articleList = false,
    articleListInit = {},
  } = opts

  const threads = community.threads
    ? community.threads.map((thread) => ({ ...thread }))
    : COMMUNITY_THREADS.map((thread) => ({ ...thread }))

  const initCommunity: TCommunity = {
    ...community,
    slug: community.slug ?? 'acme',
    threads,
  }

  const initDashboard: TDashboardInit = {
    now,
    metric,
    ...dashboard,
  }

  const Wrapper: FC<{ children: ReactNode }> = ({ children }) => {
    const Content = (
      <ThemeStoreProvider>
        <LocaleStoreProvider initData={{ locale, localeData }}>
          <CommunityStoreProvider initData={initCommunity}>
            <DashboardStoreProvider initData={initDashboard}>
              <WallpaperStoreProvider initData={wallpaper}>{children}</WallpaperStoreProvider>
            </DashboardStoreProvider>
          </CommunityStoreProvider>
        </LocaleStoreProvider>
      </ThemeStoreProvider>
    )

    if (!articleList) return Content

    return <ArticleListStoreProvider initData={articleListInit}>{Content}</ArticleListStoreProvider>
  }

  return Wrapper
}
