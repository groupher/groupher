import type { WALLPAPER_TYPE } from '~/const/wallpaper'
import type { TMeshGradientRecipe, TWallpaperTexture } from '~/lib/wallpaperMesh'
import type { TConstValues } from '~/spec'

export type TWallpaperFmt = {
  effect: string
  background: string
}

export type TWallpaperGradientDir = string

export type TWallpaperGradient = {
  colors?: string[]
  hasPattern?: boolean
  direction?: TWallpaperGradientDir

  // Applied by dashboard wallpaper settings before parsing the render background.
  blurIntensity?: number
  brightness?: number
  saturation?: number
}

export type TWallpaperPic = {
  image?: string
  preview?: string
  bgSize?: string // 'contain' | 'cover' | 'auto'

  // Applied by dashboard wallpaper settings before parsing the render background.
  blurIntensity?: number
  brightness?: number
  saturation?: number
}

export type TWallpaper = TWallpaperGradient | TWallpaperPic

export type TCustomWallpaper = TWallpaper | null

export type TWallpaperType = TConstValues<typeof WALLPAPER_TYPE>

export type TWallpaperInfo = {
  customWallpaper?: TCustomWallpaper
  source: string
  wallpapers: Record<string, TWallpaper>
  gradientWallpapers?: Record<string, TWallpaper>

  changeWallpaper?: (source: string) => void
}

export type TWallpaperData = {
  source: string
  gradientWallpapers: Record<string, TWallpaper>
  patternWallpapers: Record<string, TWallpaper>
  type: TWallpaperType
  hasPattern: boolean
  gradientDeg: number
  hasBlur: boolean
  blurIntensity: number
  hasShadow: boolean
  brightness: number
  saturation: number
  mesh: TMeshGradientRecipe | null
  texture: TWallpaperTexture
  bgSize: string
}

export type TParsedWallpaper = TWallpaperData & {
  initWallpaper: TWallpaperData
}
