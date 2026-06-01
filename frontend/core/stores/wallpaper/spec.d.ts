import type { TGradientRecipe, TWallpaperTexture } from '~/lib/wallpaperMesh'
import type {
  TCustomWallpaper,
  TWallpaperBgSize,
  TWallpaperPatternTone,
  TWallpaperType,
} from '~/spec'

export type TWallpaperThemeState = {
  customWallpaper: TCustomWallpaper
  source: string
  type: TWallpaperType

  hasPattern: boolean
  patternId: string
  patternIntensity: number
  patternTone: TWallpaperPatternTone
  hasTexture: boolean
  gradient: TGradientRecipe | null
  blurIntensity: number
  hasShadow: boolean
  brightness: number
  saturation: number
  texture: TWallpaperTexture

  bgSize: TWallpaperBgSize
}

export type TWallpaperDarkState = {
  sourceDark: string
  typeDark: TWallpaperType

  hasPatternDark: boolean
  patternIdDark: string
  patternIntensityDark: number
  patternToneDark: TWallpaperPatternTone
  hasTextureDark: boolean
  gradientDark: TGradientRecipe | null
  blurIntensityDark: number
  hasShadowDark: boolean
  brightnessDark: number
  saturationDark: number
  textureDark: TWallpaperTexture

  bgSizeDark: TWallpaperBgSize
}

export type TWallpaperState = TWallpaperThemeState & TWallpaperDarkState

export type TStore = TWallpaperState & {
  original: TWallpaperState
  // actions
  commit: (patch: Partial<TStore>) => void
}

export type TInit = Partial<TStore>
