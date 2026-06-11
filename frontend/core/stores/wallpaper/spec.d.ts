import type { TBgConfig } from '~/lib/bg'

export type TWallpaperContentShadow = {
  enabled: boolean
}

export type TWallpaperThemeState = TBgConfig & {
  contentShadow: TWallpaperContentShadow
}

export type TWallpaperState = {
  light: TWallpaperThemeState
  dark: TWallpaperThemeState
}

export type TWallpaperPatch = {
  light?: Partial<TWallpaperThemeState>
  dark?: Partial<TWallpaperThemeState>
}

export type TStore = TWallpaperState & {
  original: TWallpaperState
  // actions
  commit: (patch: Partial<Omit<TStore, 'light' | 'dark' | 'commit'>> & TWallpaperPatch) => void
}

export type TInit = TWallpaperPatch
