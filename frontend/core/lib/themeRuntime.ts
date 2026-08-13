import THEME, {
  RESOLVED_THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  THEME_MODE,
  THEME_MODE_COOKIE,
} from '~/const/theme'
import type { TThemeMode, TThemeName } from '~/spec'

/** Resolves system theme without leaking frontend shared routing details to callers. */
export const resolveSystemTheme = (): TThemeName => {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return isDark ? THEME.DARK : THEME.LIGHT
}

/** Resolves runtime theme without leaking frontend shared routing details to callers. */
export const resolveRuntimeTheme = (mode: TThemeMode): TThemeName => {
  if (mode === THEME_MODE.LIGHT) return THEME.LIGHT
  if (mode === THEME_MODE.DARK) return THEME.DARK

  return resolveSystemTheme()
}

/** Runs the persist theme cookies operation at the frontend shared boundary. */
export const persistThemeCookies = (mode: TThemeMode, theme: TThemeName): void => {
  if (typeof document === 'undefined') return
  if (document.documentElement.dataset.themeMode === undefined) return

  const attributes = `Path=/; Max-Age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`
  document.documentElement.dataset.themeMode = mode
  document.cookie = `${THEME_MODE_COOKIE}=${mode}; ${attributes}`
  document.cookie = `${RESOLVED_THEME_COOKIE}=${theme}; ${attributes}`
}
