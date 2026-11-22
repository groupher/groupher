import type { WALLPAPER_PATTERN_TONE } from '~/const/wallpaper'
import type { TBgEffect, TBgPattern, TBgTexture } from '~/lib/bg'
import type { WallpaperType } from '~/lib/graphql/generated/enums'
import type { TGradientRecipe } from '~/lib/wallpaperMesh'

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
  /** Stable Assets Hub ref retained when the image is uploaded by the editor. */
  assetPublicRef?: string | null

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

/**
 * A custom wallpaper is a tagged value in shared background state. The tag is
 * deliberately part of the domain value so renderers never infer the branch
 * from optional fields such as `image`.
 */
export type TCustomWallpaper =
  | ({ type: 'gradient' } & TWallpaperGradient)
  | ({ type: 'picture' } & TWallpaperPic)
  | null

export type TWallpaperType = Lowercase<WallpaperType>

export type TWallpaperPatternTone = WALLPAPER_PATTERN_TONE

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
  gradientPalettes: Record<string, TGradientPalette>
  gradientWallpapers: Record<string, TGradientRecipe>
  patternWallpapers: Record<string, TWallpaper>
  type: TWallpaperType
  pattern: TBgPattern
  texture: TBgTexture
  hasBlur: boolean
  contentShadow: boolean
  effect: TBgEffect
  gradient: TGradientRecipe | null
}

export type TWallpaperConfigData = {
  customWallpaper: TCustomWallpaper
  assetPublicRef?: string | null
  source: string
  type: TWallpaperType
  pattern: TBgPattern
  texture: TBgTexture
  hasBlur?: boolean
  contentShadow: boolean
  effect: TBgEffect
  gradient: TGradientRecipe | null
}

export type TWallpaperConfig = {
  light: Partial<TWallpaperConfigData>
  dark: Partial<TWallpaperConfigData>
}
export type TPublishedWallpaperImage = {
  url: string
  width: number
  height: number
}

export type TPublishedWallpaper = {
  version: number
  lightSource?: string | null
  darkSource?: string | null
  light: Record<
    import('~/lib/wallpaperProfiles').TWallpaperProfile,
    TPublishedWallpaperImage
  > | null
  dark: Record<import('~/lib/wallpaperProfiles').TWallpaperProfile, TPublishedWallpaperImage> | null
}

export type TWallpaperSettingsTransportByTheme = {
  light: import('~/lib/wallpaperSettingsCodec').TWallpaperSettingsTransport
  dark: import('~/lib/wallpaperSettingsCodec').TWallpaperSettingsTransport
}

export type TParsedWallpaper = Partial<TWallpaperConfig> & {
  initWallpaper?: Partial<TWallpaperConfig>
  wallpaper?: TPublishedWallpaper | null
}
