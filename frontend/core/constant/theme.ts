import type { TThemeMode, TThemeName } from '~/spec'

export default {
  LIGHT: 'light',
  DARK: 'dark',
} as Record<Uppercase<TThemeName>, TThemeName>

export const THEME_MODE = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
} as Record<Uppercase<TThemeMode>, TThemeMode>

export const LOCAL_THEME_KEY = 'theme'
