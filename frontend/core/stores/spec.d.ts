import type { TLocale } from '~/spec'

import type { TStore as TLocaleStore } from './locale/spec'
import type { TStore as TViewingStore, TInit as TViewingInit } from './viewing/spec'
import type { TStore as TArticlesStore, TInit as TArticlesInit } from './articles/spec'
import type { TStore as TAccountStore } from './account/spec'
import type { TStore as TThemeStore, TInit as TThemeInit } from './theme/spec'
import type { TStore as TDashboardStore, TInit as TDashboardInit } from './dashboard/spec'
import type { TStore as TWallpaperStore, TInit as TWallpaperInit } from './wallpaper/spec'

export type TRootStore = {
  locale: TLocaleStore
  theme: TThemeStore
  viewing: TViewingStore
  articles: TArticlesStore
  account: TAccountStore
  dashboard: TDashboardStore
  wallpaper: TWallpaperStore
}

export type TTreeStoreKey = keyof TRootStore
export type TTreeStore<K extends TTreeStoreKey> = TRootStore[K]

export type TRootStoreInit = {
  theme?: TThemeInit
  locale?: TLocale
  localeData?: string
  viewing?: TViewingInit
  articles?: TArticlesInit
  dashboard?: TDashboardInit
  wallpaper?: TWallpaperInit
}
