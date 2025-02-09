import type { TThemeName } from '~/spec'
import THEME from '~/const/theme'

import useSubStore from '~/hooks/useSubStore'

type TRet = {
  theme: TThemeName
  isLightTheme: boolean
  isDarkTheme: boolean
  change: (name: TThemeName) => void
  toggle: () => void
}

export default (): TRet => {
  const { theme, change, toggle } = useSubStore('theme')

  return {
    theme,
    isLightTheme: theme === THEME.LIGHT,
    isDarkTheme: theme === THEME.DARK,
    change,
    toggle,
  }
}
