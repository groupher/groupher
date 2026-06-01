import type { WALLPAPER_BG_SIZE, WALLPAPER_PATTERN_TONE, WALLPAPER_TYPE } from '~/const/wallpaper'
import type { TGradientRecipe, TWallpaperTexture } from '~/lib/wallpaperMesh'

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
  bgSize?: TWallpaperBgSize

  // Applied by dashboard wallpaper settings before parsing the render background.
  blurIntensity?: number
  brightness?: number
  saturation?: number
}

export type TWallpaper = TWallpaperGradient | TWallpaperPic

export type TWallpaperPattern = {
  id: string
  image: string
  preview: string
}

export type TCustomWallpaper = TWallpaper | null

export type TWallpaperType = WALLPAPER_TYPE

export type TWallpaperPatternTone = WALLPAPER_PATTERN_TONE

export type TWallpaperBgSize = WALLPAPER_BG_SIZE

export type TGradientPalette = {
  key: string
  label: string
  colors: string[]
}

export type TGradientEffectInit = {
  angle: number
  spread: number
}

export type TWallpaperInfo = {
  customWallpaper?: TCustomWallpaper
  source: string
  wallpapers: Record<string, TWallpaper>
  gradientPalettes?: Record<string, TGradientPalette>
  gradientWallpapers?: Record<string, TGradientRecipe>

  changeWallpaper?: (source: string) => void
}

export type TWallpaperData = {
  source: string
  sourceDark: string
  gradientPalettes: Record<string, TGradientPalette>
  gradientWallpapers: Record<string, TGradientRecipe>
  patternWallpapers: Record<string, TWallpaper>
  type: TWallpaperType
  typeDark: TWallpaperType
  hasPattern: boolean
  hasPatternDark: boolean
  patternId: string
  patternIdDark: string
  patternIntensity: number
  patternIntensityDark: number
  patternTone: TWallpaperPatternTone
  patternToneDark: TWallpaperPatternTone
  hasTexture: boolean
  hasTextureDark: boolean
  hasBlur: boolean
  blurIntensity: number
  blurIntensityDark: number
  hasShadow: boolean
  hasShadowDark: boolean
  brightness: number
  brightnessDark: number
  saturation: number
  saturationDark: number
  gradient: TGradientRecipe | null
  gradientDark: TGradientRecipe | null
  texture: TWallpaperTexture
  textureDark: TWallpaperTexture
  bgSize: TWallpaperBgSize
  bgSizeDark: TWallpaperBgSize
}

export type TParsedWallpaper = TWallpaperData & {
  initWallpaper: TWallpaperData
}
