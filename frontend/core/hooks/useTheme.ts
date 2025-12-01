import THEME, { LOCAL_THEME_KEY, THEME_MODE } from '~/const/theme'
import useSubStore from '~/hooks/useSubStore'
import type { TThemeMode, TThemeName } from '~/spec'

type TRet = {
  theme: TThemeName
  themeMode: TThemeMode
  isLightTheme: boolean
  isDarkTheme: boolean
  change: (name: TThemeName) => void
  changeMode: (name: TThemeMode) => void
  toggle: () => void
}

export default (): TRet => {
  const { theme, themeMode, change: changeTheme, changeMode: doChangeMode } = useSubStore('theme')

  const resolveSystemTheme = () => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    return isDark ? THEME.DARK : THEME.LIGHT
  }

  const applyTheme = (t: TThemeName) => {
    changeTheme(t)
    document.documentElement.setAttribute('data-theme', t)
  }

  const changeMode = (mode: TThemeMode) => {
    doChangeMode(mode)

    try {
      localStorage.setItem(LOCAL_THEME_KEY, mode)
    } catch {}

    if (mode === THEME_MODE.LIGHT) applyTheme(THEME.LIGHT)
    else if (mode === THEME_MODE.DARK) applyTheme(THEME.DARK)
    else applyTheme(resolveSystemTheme()) // SYSTEM 模式
  }

  const toggle = () => {
    if (theme === THEME.DARK) {
      applyTheme(THEME.LIGHT)
      return
    }

    applyTheme(THEME.DARK)
  }

  return {
    theme,
    themeMode,
    isLightTheme: theme === THEME.LIGHT,
    isDarkTheme: theme === THEME.DARK,
    change: changeTheme,
    changeMode,
    toggle,
  }
}
