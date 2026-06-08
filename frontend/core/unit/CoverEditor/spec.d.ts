import type { TConstValues, TWallpaper, TWallpaperGradientDir } from '~/spec'

import type {
  BORDER_HIGHLIGHT_MODE,
  COVER_SHADOW_COLOR_MODE,
  COVER_SHADOW_PRESET,
  IMAGE_POS,
  MAGNIFIER_BORDER_COLOR,
} from './constant'

export type TBorderHighlightMode = TConstValues<typeof BORDER_HIGHLIGHT_MODE>

export type TCoverPoint = {
  x: number
  y: number
}

export type TBorderHighlight = {
  enabled: boolean
  mode: TBorderHighlightMode
  angle: number
  length: number
  hue: number
  rainbowHue?: number
  saturation: number
  lightness: number
  opacity: number
}

export type TCoverShadowPreset = TConstValues<typeof COVER_SHADOW_PRESET>

export type TCoverShadowColorMode = TConstValues<typeof COVER_SHADOW_COLOR_MODE>

export type TCoverShadow = {
  preset: TCoverShadowPreset
  colorMode: TCoverShadowColorMode
  hue: number
  rainbowHue: number
  x: number
  y: number
  blur: number
  spread: number
  opacity: number
}

export type TMagnifierBorderColor = TConstValues<typeof MAGNIFIER_BORDER_COLOR>

export type TMagnifierAppearance = {
  borderColor: TMagnifierBorderColor
  borderWidth: number
  highlightCenter: TCoverPoint
  highlightIntensity: number
  shadow: number
}

export type TStore = {
  position: TCoverPoint
  magnifierCenter: TCoverPoint
  magnifierRadius: number
  magnifierZoom: number
  magnifierAppearance: TMagnifierAppearance
  hasMagnifier: boolean
  shadow: TCoverShadow
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
  magnifierCenter: TCoverPoint
  magnifierRadius: number
  magnifierZoom: number
  magnifierAppearance: TMagnifierAppearance
  hasMagnifier: boolean
  shadow: TCoverShadow
  borderRadius: number
  borderHighlight: TBorderHighlight
  wallpapers: Record<string, TWallpaper>
  wallpaper: string
  direction: TWallpaperGradientDir
  size: TImageSize
  rotate: number
  hasGlassBorder: boolean
}
