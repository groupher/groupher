import type THEME from '~/const/theme'
import type { THEME_MODE } from '~/const/theme'

export type TThemeName = (typeof THEME)[keyof typeof THEME]
export type TThemeMode = (typeof THEME_MODE)[keyof typeof THEME_MODE]

// export type TTheme = ((obj: any) => unknown) | string
export type TTheme = string
