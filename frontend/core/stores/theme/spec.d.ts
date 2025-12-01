import type { TThemeMode, TThemeName } from '~/spec'

export type TStore = {
  theme: TThemeName
  themeMode: TThemeMode
  // actions
  change: (theme: TThemeName) => void
  changeMode: (theme: TThemeMode) => void
}

export type TInit = TThemeName
