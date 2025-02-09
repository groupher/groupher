import type { TWallpaper, TWallpaperGradientDir } from '~/spec'

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

  // drived
  gradientWallpapers: Record<string, TWallpaper>
  toolboxSetting: TToolboxSetting

  commit: (patch: Partial<TStore>) => void
}

export type TImagePos =
  | 'top_left'
  | 'top_center'
  | 'top_right'
  | 'center_left'
  | 'center'
  | 'center_right'
  | 'bottom_left'
  | 'bottom_center'
  | 'bottom_right'
  | 'none'

export type TLinearBorderPos =
  | 'top_left'
  | 'top_right'
  | 'top'
  | 'bottom_left'
  | 'bottom'
  | 'bottom_right'
  | 'top_all'
  | 'bottom_all'
  | 'left_all'
  | 'right_all'
  | 'all'
  | 'none'

export type TImageSizeValue = {
  height: string
  width: string
}

export type TSettingLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5'
export type TImageSize = 'large' | 'medium' | 'small'
export type TImageRadio = 'square' | 'tv' | 'screen'
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
