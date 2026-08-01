import THEME, { LOCAL_THEME_KEY, THEME_MODE } from '~/const/theme'
import type { TThemeMode, TThemeName } from '~/spec'
import useThemeDomain from '~/stores/theme/hooks'
import { removeThemeFirstPaintVars } from '~/utils/themeFirstPaint'

type TRet = {
  theme: TThemeName
  themeMode: TThemeMode
  isLightTheme: boolean
  isDarkTheme: boolean
  change: (name: TThemeName) => void
  changeMode: (name: TThemeMode, options?: TApplyRuntimeThemeOptions) => void
  preview: (name: TThemeName) => void
  toggle: () => void
}

type TApplyRuntimeThemeOptions = {
  keepFirstPaintVars?: boolean
}

export default function useTheme(): TRet {
  const { theme, themeMode, change: changeTheme, changeMode: doChangeMode } = useThemeDomain()

  const resolveSystemTheme = () => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    return isDark ? THEME.DARK : THEME.LIGHT
  }

  const applyTheme = (t: TThemeName) => {
    changeTheme(t)
    document.documentElement.setAttribute('data-theme', t)
    document.documentElement.style.colorScheme = t
  }

  const applyRuntimeTheme = (t: TThemeName, options: TApplyRuntimeThemeOptions = {}) => {
    applyTheme(t)

    if (!options.keepFirstPaintVars) {
      removeThemeFirstPaintVars()
    }
  }

  const changeMode = (mode: TThemeMode, options?: TApplyRuntimeThemeOptions) => {
    doChangeMode(mode)

    try {
      localStorage.setItem(LOCAL_THEME_KEY, mode)
    } catch {}

    if (mode === THEME_MODE.LIGHT) applyRuntimeTheme(THEME.LIGHT, options)
    else if (mode === THEME_MODE.DARK) applyRuntimeTheme(THEME.DARK, options)
    else applyRuntimeTheme(resolveSystemTheme(), options) // SYSTEM 模式
  }

  const toggle = () => {
    if (theme === THEME.DARK) {
      applyRuntimeTheme(THEME.LIGHT)
      return
    }

    applyRuntimeTheme(THEME.DARK)
  }

  return {
    theme,
    themeMode,
    isLightTheme: theme === THEME.LIGHT,
    isDarkTheme: theme === THEME.DARK,
    change: changeTheme,
    changeMode,
    preview: applyRuntimeTheme,
    toggle,
  }
}
