import type { TThemeName } from '~/spec'

export type TStore = {
  theme: TThemeName
  // actions
  change: (theme: TThemeName) => void
  toggle: () => void
}

export type TInit = TThemeName
