import THEME, { THEME_MODE } from '~/const/theme'
import type { TThemeMode, TThemeName } from '~/spec'

export const resolveSystemTheme = (): TThemeName => {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return isDark ? THEME.DARK : THEME.LIGHT
}

export const resolveRuntimeTheme = (mode: TThemeMode): TThemeName => {
  if (mode === THEME_MODE.LIGHT) return THEME.LIGHT
  if (mode === THEME_MODE.DARK) return THEME.DARK

  return resolveSystemTheme()
}
