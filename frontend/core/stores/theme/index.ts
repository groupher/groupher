import { proxy } from 'valtio'
import THEME from '~/const/theme'
import type { TThemeMap, TThemeName } from '~/spec'
import { themeSkins } from '~/utils/themes'

import type { TInit, TStore } from './spec'

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
