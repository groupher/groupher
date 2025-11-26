import { proxy } from 'valtio'
import THEME from '~/const/theme'
import type { TThemeName } from '~/spec'

import type { TInit, TStore } from './spec'

export default (theme: TInit = THEME.LIGHT): TStore => {
  const store = proxy({
    theme,

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
