import { proxy } from 'valtio'

import type { TThemeMap, TThemeName } from '~/spec'

import THEME from '~/const/theme'
import { themeSkins } from '~/utils/themes'

import type { TStore, TInit } from './spec'

export default (theme: TInit = THEME.LIGHT): TStore => {
  const store = proxy({
    theme,

    // views
    get themeData(): TThemeMap {
      return themeSkins[store.theme] as TThemeMap
    },

    // actions
    change: (theme: TThemeName): void => {
      store.theme = theme
    },

    toggle: (): void => {
      store.theme = store.theme === THEME.LIGHT ? THEME.DARK : THEME.LIGHT
    },
  })

  return store
}
