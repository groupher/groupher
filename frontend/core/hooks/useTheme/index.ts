import THEME, { LOCAL_THEME_KEY, THEME_MODE } from '~/const/theme'
import { persistThemeCookies, resolveSystemTheme } from '~/lib/themeRuntime'
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

/** Exposes theme state and actions through the shared React hook boundary. */
export default function useTheme(): TRet {
  const { theme, themeMode, change: changeTheme, changeMode: doChangeMode } = useThemeDomain()

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

    const runtimeTheme =
      mode === THEME_MODE.LIGHT
        ? THEME.LIGHT
        : mode === THEME_MODE.DARK
          ? THEME.DARK
          : resolveSystemTheme()

    applyRuntimeTheme(runtimeTheme, options)
    persistThemeCookies(mode, runtimeTheme)
  }

  const toggle = () => {
    if (theme === THEME.DARK) {
      applyRuntimeTheme(THEME.LIGHT)
      persistThemeCookies(themeMode, THEME.LIGHT)
      return
    }

    applyRuntimeTheme(THEME.DARK)
    persistThemeCookies(themeMode, THEME.DARK)
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
