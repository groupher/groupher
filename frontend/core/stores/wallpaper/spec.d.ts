import type { TImageTextureType } from '~/lib/wallpaperMesh'
import type { TCustomWallpaper, TWallpaperGradientDir, TWallpaperType } from '~/spec'

export type TWallpaperState = {
  customWallpaper: TCustomWallpaper
  customColorValue: string
  source: string
  type: TWallpaperType

  hasPattern: boolean
  blurIntensity: number
  hasShadow: boolean
  brightness: number
  saturation: number
  textureType: TImageTextureType
  textureStrength: number

  direction: TWallpaperGradientDir
  bgSize: string
}

export type TStore = TWallpaperState & {
  original: TWallpaperState
  // actions
  commit: (patch: Partial<TStore>) => void
}

export type TInit = Partial<TStore>
