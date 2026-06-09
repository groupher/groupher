import type { TBgConfig, TBgThemeConfig } from '~/lib/bg/spec'
import type { TGradientRecipe, TWallpaperTexture } from '~/lib/wallpaperMesh'
import type { TConstValues } from '~/spec'

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
  imageDominantColor: string | null
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
  background: TBgThemeConfig
  originalBackground: TBgThemeConfig
  loadedImageUrl: string

  // derived
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
  imageDominantColor: string | null
  position: TCoverPoint
  magnifierCenter: TCoverPoint
  magnifierRadius: number
  magnifierZoom: number
  magnifierAppearance: TMagnifierAppearance
  hasMagnifier: boolean
  shadow: TCoverShadow
  borderRadius: number
  borderHighlight: TBorderHighlight
  background: TBgThemeConfig
  activeBackground: TBgConfig
  isBackgroundTouched: boolean
  size: TImageSize
  rotate: number
  hasGlassBorder: boolean
}

export type TCoverBackgroundPatch = Partial<TBgConfig>

export type TCoverBackgroundRange = Pick<TBgConfig, 'blurIntensity' | 'brightness' | 'saturation'>

export type TCoverBackgroundGradientPatch = Partial<TGradientRecipe>

export type TCoverBackgroundTexturePatch = Partial<TWallpaperTexture>
