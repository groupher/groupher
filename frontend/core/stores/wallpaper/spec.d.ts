import type { TCustomWallpaper, TWallpaperGradientDir, TWallpaperType } from '~/spec'

export type TWallpaperState = {
  customWallpaper: TCustomWallpaper
  customColorValue: string
  source: string
  type: TWallpaperType

  hasPattern: boolean
  hasBlur: boolean
  hasShadow: boolean

  direction: TWallpaperGradientDir
  bgSize: string
}

export type TStore = TWallpaperState & {
  original: TWallpaperState
  // actions
  commit: (patch: Partial<TStore>) => void
}

export type TInit = Partial<TStore>
