import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { FC, ReactNode } from 'react'

import METRIC from '~/const/metric'
import { COMMUNITY_THREADS } from '~/const/thread'
import { FIELDS } from '~/constant/dsb-fields'
import { createQueryClient, dsbKeys } from '~/query'
import type { TCommunity, TLocale, TMetric, TParseDashboard } from '~/spec'
import ArticleListStoreProvider from '~/stores/articleList/provider'
import type { TInit as TArticleListInit } from '~/stores/articleList/spec'
import CommunityStoreProvider from '~/stores/community/provider'
import DsbConfigProvider from '~/stores/dsbConfig/provider'
import DsbEditProvider from '~/stores/dsbEdit/provider'
import { DsbEditorUiProvider } from '~/stores/dsbEditorUi'
import LocaleStoreProvider from '~/stores/locale/provider'
import { MetricProvider } from '~/stores/metric'
import ThemeStoreProvider from '~/stores/theme/provider'
import ThemePresetStoreProvider from '~/stores/ThemePreset/provider'
import WallpaperStoreProvider from '~/stores/wallpaper/provider'
import type { TInit as TWallpaperInit } from '~/stores/wallpaper/spec'

export type TWrapperOpts = {
  metric?: TMetric
  locale?: TLocale
  localeData?: string
  community?: Partial<Omit<TCommunity, 'slug'>> & { slug?: string }
  dashboard?: Partial<TParseDashboard>
  wallpaper?: TWallpaperInit
  articleList?: boolean
  articleListInit?: TArticleListInit
  dsbEdit?: boolean
  queryClient?: QueryClient
}

export const makeStoreWrapper = (opts: TWrapperOpts = {}): FC<{ children: ReactNode }> => {
  const {
    metric = METRIC.COMMUNITY,
    locale = 'en',
    localeData = '{}',
    community = {},
    dashboard = {},
    wallpaper = {},
    articleList = false,
    articleListInit = {},
    dsbEdit = false,
    queryClient: providedQueryClient,
  } = opts

  const threads = community.threads
    ? community.threads.map((thread) => ({ ...thread }))
    : COMMUNITY_THREADS.map((thread) => ({ ...thread }))

  const initCommunity: TCommunity = {
    ...community,
    slug: community.slug ?? 'acme',
    threads,
  }

  const initDashboard: TParseDashboard = {
    ...FIELDS,
    ...dashboard,
    original: {
      ...FIELDS,
      ...dashboard,
    },
  }
  const queryClient = providedQueryClient ?? createQueryClient()
  queryClient.setQueryData(dsbKeys.slug(initCommunity.slug), initDashboard)

  const Wrapper: FC<{ children: ReactNode }> = ({ children }) => {
    const content = (
      <ThemeStoreProvider>
        <LocaleStoreProvider initData={{ locale, localeData }}>
          <MetricProvider value={metric}>
            <CommunityStoreProvider initData={initCommunity}>
              <DsbConfigProvider initData={initDashboard}>
                <ThemePresetStoreProvider initData={initDashboard}>
                  <WallpaperStoreProvider initData={wallpaper}>{children}</WallpaperStoreProvider>
                </ThemePresetStoreProvider>
              </DsbConfigProvider>
            </CommunityStoreProvider>
          </MetricProvider>
        </LocaleStoreProvider>
      </ThemeStoreProvider>
    )

    const Content = dsbEdit ? (
      <DsbEditorUiProvider>
        <DsbEditProvider initialData={initDashboard}>{content}</DsbEditProvider>
      </DsbEditorUiProvider>
    ) : (
      content
    )

    const QueryContent = <QueryClientProvider client={queryClient}>{Content}</QueryClientProvider>

    if (!articleList) return QueryContent

    return (
      <ArticleListStoreProvider initData={articleListInit}>{QueryContent}</ArticleListStoreProvider>
    )
  }

  return Wrapper
}
