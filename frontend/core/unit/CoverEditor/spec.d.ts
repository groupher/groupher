import type { TConstValues, TWallpaper, TWallpaperGradientDir } from '~/spec'

import type { IMAGE_POS } from './constant'

export type TCoverPoint = {
  x: number
  y: number
}

export type TBorderHighlight = {
  enabled: boolean
  angle: number
  length: number
  hue: number
  opacity: number
}

export type TStore = {
  position: TCoverPoint
  lightCenter: TCoverPoint
  lightRadius: number
  hasLight: boolean
  shadow: number
  borderRadius: number
  borderHighlight: TBorderHighlight
  size: TImageSize
  rotate: number
  hasGlassBorder: boolean
  wallpaper: string
  hasPattern: boolean
  hasBlur: boolean
  direction: TWallpaperGradientDir
  loadedImageUrl: string

  // derived
  gradientWallpapers: Record<string, TWallpaper>
  tuningSetting: TTuningSetting

  commit: (patch: Partial<TStore>) => void
}

export type TImagePos = TConstValues<typeof IMAGE_POS>

export type TImageSizeValue = {
  height: string
  width: string
}

export type TImageSize = number
export type TImageRotate = string

export type TTuningSetting = {
  position: TCoverPoint
  lightCenter: TCoverPoint
  lightRadius: number
  hasLight: boolean
  shadow: number
  borderRadius: number
  borderHighlight: TBorderHighlight
  wallpapers: Record<string, TWallpaper>
  wallpaper: string
  direction: TWallpaperGradientDir
  size: TImageSize
  rotate: number
  hasGlassBorder: boolean
}
