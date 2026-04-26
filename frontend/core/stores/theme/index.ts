import { proxy } from 'valtio'

import THEME, { THEME_MODE } from '~/const/theme'
import type { TThemeMode, TThemeName } from '~/spec'

import type { TInit, TStore } from './spec'

export default function ThemeStore(
  themeMode: TThemeMode = THEME_MODE.SYSTEM,
  theme: TInit = THEME.LIGHT,
): TStore {
  const store = proxy({
    theme,
    themeMode,

    // actions
    change: (theme: TThemeName): void => {
      store.theme = theme
    },

    changeMode: (theme: TThemeMode): void => {
      store.themeMode = theme
    },
  })

  return store
}
