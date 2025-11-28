import type { TThemeName } from '~/spec'

export default {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
} as Record<Uppercase<TThemeName>, TThemeName>

export const LOCAL_THEME_KEY = 'theme'
