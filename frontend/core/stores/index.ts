'use client'

import { createContext, useContext } from 'react'
import { proxy } from 'valtio'
import { LOCALE } from '~/const/i18n'

import THEME, { THEME_MODE } from '~/const/theme'
import setupAccount from './account'
import setupArticles from './articles'
import setupDashboard from './dashboard'
import setupLocale from './locale'
import type { TRootStore, TRootStoreInit } from './spec'
import setupTheme from './theme'
import setupViewing from './viewing'
import setupWallpaper from './wallpaper'

export { default as StoreProvider } from './provider'

const INITIAL_STATE = {
  theme: THEME.LIGHT,
  themeMode: THEME_MODE.SYSTEM,
  locale: LOCALE.EN,
  localeData: '{}',
  viewing: {},
  dashboard: {},
  wallpaper: {},
  articles: {},
}

export const setupRootStore = (init: TRootStoreInit = INITIAL_STATE): TRootStore => {
  return proxy({
    locale: setupLocale(init.locale, init.localeData),
    account: setupAccount(),
    theme: setupTheme(init.themeMode, init.theme),
    viewing: setupViewing(init.viewing),
    articles: setupArticles(init.articles),
    dashboard: setupDashboard(init.dashboard),
    wallpaper: setupWallpaper(init.wallpaper),
  })
}

export const StoreContext = createContext<TRootStore | null>(null)

export const useStore = () => {
  const store = useContext(StoreContext)
  if (!store) {
    throw new Error('useStore must be used within a StoreProvider')
  }
  return store
}
