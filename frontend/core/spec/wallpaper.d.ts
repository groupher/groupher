import type { GRADIENT_DIRECTION, WALLPAPER_TYPE } from '~/const/wallpaper'
import type { TConstValues } from '~/spec'

export type TWallpaperFmt = {
  effect: string
  background: string
}

export type TWallpaperGradientDir = TConstValues<typeof GRADIENT_DIRECTION>

export type TWallpaperGradient = {
  colors?: string[]
  hasPattern?: boolean
  direction?: TWallpaperGradientDir

  // common
  hasBlur?: boolean
  hasShadow?: boolean
}

export type TWallpaperPic = {
  bgImage?: string
  bgSize?: string // 'contain' | 'cover' | 'auto'

  // common
  hasBlur?: boolean
  hasShadow?: boolean
}

export type TWallpaper = TWallpaperGradient | TWallpaperPic

export type TCustomWallpaper = TWallpaper | null

export type TWallpaperType = TConstValues<typeof WALLPAPER_TYPE>

export type TWallpaperInfo = {
  customWallpaper?: TCustomWallpaper
  wallpaper: string
  wallpapers: Record<string, TWallpaper>
  hasShadow?: boolean
  gradientWallpapers?: Record<string, TWallpaper>

  changeWallpaper?: (wallpaper: string) => void
}

export type TWallpaperData = {
  wallpaper: string
  gradientWallpapers: Record<string, TWallpaper>
  patternWallpapers: Record<string, TWallpaper>
  wallpaperType: TWallpaperType
  hasPattern: boolean
  hasBlur: boolean
  hasShadow: boolean
  direction: TWallpaperGradientDir

  customColor: string
}

export type TParsedWallpaper = TWallpaperData & {
  initWallpaper: TWallpaperData
}
