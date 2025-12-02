import type { TLocale, TThemeMode } from '~/spec'
import type { TStore as TAccountStore } from './account/spec'
import type { TInit as TArticlesInit, TStore as TArticlesStore } from './articles/spec'
import type { TInit as TDsbInit, TStore as TDsbStore } from './dashboard/spec'
import type { TStore as TLocaleStore } from './locale/spec'
import type { TInit as TThemeInit, TStore as TThemeStore } from './theme/spec'
import type { TInit as TViewingInit, TStore as TViewingStore } from './viewing/spec'
import type { TInit as TWallpaperInit, TStore as TWallpaperStore } from './wallpaper/spec'

export type TRootStore = {
  locale: TLocaleStore
  theme: TThemeStore
  viewing: TViewingStore
  articles: TArticlesStore
  account: TAccountStore
  dashboard: TDsbStore
  wallpaper: TWallpaperStore
}

export type TTreeStoreKey = keyof TRootStore
export type TTreeStore<K extends TTreeStoreKey> = TRootStore[K]

export type TRootStoreInit = {
  theme?: TThemeInit
  themeMode?: TThemeMode
  locale?: TLocale
  localeData?: string
  viewing?: TViewingInit
  articles?: TArticlesInit
  dashboard?: TDsbInit
  wallpaper?: TWallpaperInit
}
