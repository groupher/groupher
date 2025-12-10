import type { TCustomWallpaper, TWallpaperGradientDir, TWallpaperType } from '~/spec'

export type TWallpaperState = {
  customWallpaper: TCustomWallpaper
  customColorValue: string
  wallpaper: string
  wallpaperType: TWallpaperType

  hasBlur: boolean
  hasPattern: boolean
  hasShadow: boolean

  direction: TWallpaperGradientDir
  bgSize: string
  uploadBgImage: string
}

export type TStore = TWallpaperState & {
  original: TWallpaperState
  // actions
  commit: (patch: Partial<TStore>) => void
}

export type TInit = Partial<TStore>
