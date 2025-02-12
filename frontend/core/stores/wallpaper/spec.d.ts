import type { TCustomWallpaper, TWallpaper, TWallpaperType, TWallpaperGradientDir } from '~/spec'

export type TWallpaperState = {
  customWallpaper: TCustomWallpaper
  customColorValue: strign
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

export type TInitState = Partial<TStore>
