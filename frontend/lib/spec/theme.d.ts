import type DayTheme from '~/utils/themes/skins/light'

export type TThemeName = 'light' | 'dark'

// export type TTheme = ((obj: any) => unknown) | string
export type TTheme = string
// export type TTheme = string

export type TThemeMap = typeof DayTheme
