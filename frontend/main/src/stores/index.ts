'use client'

import { createContext } from 'react'
import { proxy } from 'valtio'

import type { TRootStore } from './spec'

import THEME from '~/const/theme'
import { LOCALE } from '~/const/i18n'

import setupLocale from './locale'
import setupTheme from './theme'
import setupAccount from './account'
import setupArticles from './articles'
import setupViewing from './viewing'
import setupDashboard from './dashboard'
import setupWallpaper from './wallpaper'

const INITIAL_STATE = {
  theme: THEME.LIGHT,
  locale: LOCALE.EN,
  localeData: '{}',
  viewing: {},
  dashboard: {},
  wallpaper: {},
  articles: {},
}

const setupRootStore = (init = INITIAL_STATE): TRootStore => {
  return proxy({
    locale: setupLocale(init.locale, init.localeData),
    account: setupAccount(),
    theme: setupTheme(init.theme),
    viewing: setupViewing(init.viewing),
    articles: setupArticles(init.articles),
    dashboard: setupDashboard(init.dashboard),
    wallpaper: setupWallpaper(init.wallpaper),
  })
}

export const StoreContext = createContext(setupRootStore())

export const useStore = (initState) => {
  // see details: https://valtio.pmnd.rs/docs/how-tos/how-to-use-with-context
  // return useRef(proxy(setupRootStore(initState))).current
  // do not use useRef above, otherwise the useStore will not update in some cases
  return setupRootStore(initState)
}
