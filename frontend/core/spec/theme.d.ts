import type THEME from '~/const/theme'
import type { THEME_MODE } from '~/const/theme'
import type { TConstValues } from '~/spec'

export type TThemeName = TConstValues<typeof THEME>
export type TThemeMode = TConstValues<typeof THEME_MODE>

// export type TTheme = ((obj: any) => unknown) | string
export type TTheme = string
