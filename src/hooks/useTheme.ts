import { useTheme as useStyledTheme } from 'styled-components'

import type { TThemeName, TThemeMap } from '~/spec'
import THEME from '~/const/theme'

import useSubStore from '~/hooks/useSubStore'

type TRet = {
  theme: TThemeName
  isLightTheme: boolean
  isDarkTheme: boolean
  themeMap: TThemeMap
  change: (name: TThemeName) => void
  toggle: () => void
}

export default (): TRet => {
  const { theme, change, toggle } = useSubStore('theme')
  const styledTheme = useStyledTheme() as TThemeMap

  return {
    theme,
    isLightTheme: theme === THEME.LIGHT,
    isDarkTheme: theme === THEME.DARK,
    themeMap: styledTheme,
    change,
    toggle,
  }
}
