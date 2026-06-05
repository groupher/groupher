import type { TConstValues, TWallpaper, TWallpaperGradientDir } from '~/spec'

import type { IMAGE_POS, IMAGE_RATIO, SETTING_LEVEL } from './constant'

export type TCoverPoint = {
  x: number
  y: number
}

export type TBorderHighlight = {
  enabled: boolean
  angle: number
  length: number
}

export type TStore = {
  position: TCoverPoint
  lightCenter: TCoverPoint
  hasLight: boolean
  shadowLevel: TSettingLevel
  borderRadiusLevel: TSettingLevel
  borderHighlight: TBorderHighlight
  size: TImageSize
  ratio: TImageRadio
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

export type TSettingLevel = TConstValues<typeof SETTING_LEVEL>
export type TImageSize = number
export type TImageRadio = TConstValues<typeof IMAGE_RATIO>
export type TImageRotate = string

export type TTuningSetting = {
  position: TCoverPoint
  lightCenter: TCoverPoint
  hasLight: boolean
  shadowLevel: TSettingLevel
  borderRadiusLevel: TSettingLevel
  borderHighlight: TBorderHighlight
  wallpapers: Record<string, TWallpaper>
  wallpaper: string
  direction: TWallpaperGradientDir
  size: TImageSize
  ratio: TImageRadio
  rotate: number
  hasGlassBorder: boolean
}
