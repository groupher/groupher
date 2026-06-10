import type { TGradientRecipe, TWallpaperTexture } from '~/lib/wallpaperMesh'
import type { TCustomWallpaper, TWallpaperPatternTone, TWallpaperType } from '~/spec'

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
