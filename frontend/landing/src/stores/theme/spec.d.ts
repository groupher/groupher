import type { TThemeMap, TThemeName } from '~/spec'

export type TStore = {
  theme: TThemeName
  themeData: TThemeMap
  // actions
  change: (theme: TThemeName) => void
  toggle: () => void
}
