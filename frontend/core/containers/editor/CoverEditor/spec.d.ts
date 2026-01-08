import type { TConstValues, TWallpaper, TWallpaperGradientDir } from '~/spec'
import type { IMAGE_POS, IMAGE_RATIO, IMAGE_SIZE, LINEAR_BORDER, SETTING_LEVEL } from './constant'

export type TStore = {
  imagePos: TImagePos
  lightPos: TImagePos
  shadowLevel: TSettingLevel
  borderRadiusLevel: TSettingLevel
  linearBorderPos: TLinearBorderPos
  size: TImageSize
  ratio: TImageRadio
  rotate: number
  hasGlassBorder: boolean
  wallpaper: string
  hasPattern: boolean
  hasBlur: boolean
  direction: TWallpaperGradientDir

  // derived
  gradientWallpapers: Record<string, TWallpaper>
  toolboxSetting: TToolboxSetting

  commit: (patch: Partial<TStore>) => void
}

export type TImagePos = TConstValues<typeof IMAGE_POS>
export type TLinearBorderPos = TConstValues<typeof LINEAR_BORDER>

export type TImageSizeValue = {
  height: string
  width: string
}

export type TSettingLevel = TConstValues<typeof SETTING_LEVEL>
export type TImageSize = TConstValues<typeof IMAGE_SIZE>
export type TImageRadio = TConstValues<typeof IMAGE_RATIO>
export type TImageRotate = string

export type TToolboxSetting = {
  pos: TImagePos
  lightPos: TImagePos
  shadowLevel: TSettingLevel
  borderRadiusLevel: TSettingLevel
  linearBorderPos: TLinearBorderPos
  wallpapers: Record<string, TWallpaper>
  wallpaper: string
  direction: TWallpaperGradientDir
  size: TImageSize
  ratio: TImageRadio
  rotate: number
  hasGlassBorder: boolean
}
