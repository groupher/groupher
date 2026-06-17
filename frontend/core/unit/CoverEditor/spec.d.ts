import type { TBgConfig, TBgThemeConfig } from '~/lib/bg'
import type { TGradientRecipe } from '~/lib/wallpaperMesh'
import type { TConstValues } from '~/spec'

import type {
  BORDER_HIGHLIGHT_MODE,
  COVER_IMAGE_WHICH,
  COVER_SHADOW_COLOR_MODE,
  COVER_SHADOW_PRESET,
  IMAGE_EDIT_MODE,
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

export type TCoverGlassBorder = {
  enabled: boolean
}

export type TCoverMagnifier = {
  enabled: boolean
  center: TCoverPoint
  radius: number
  zoom: number
  borderColor: TMagnifierBorderColor
  borderWidth: number
  highlightCenter: TCoverPoint
  highlightIntensity: number
  shadow: number
}

export type TCoverImageWhich = TConstValues<typeof COVER_IMAGE_WHICH>

export type TCoverCanvas = {
  canvasWidth: number
  canvasHeight: number
}

export type TCoverImageCrop = {
  x: number
  y: number
  zoom: number
}

export type TImageEditMode = TConstValues<typeof IMAGE_EDIT_MODE>

export type TCoverImageConfig = {
  which: TCoverImageWhich
  zIndex: number
  source: string
  dominantColor: string | null
  position: TCoverPoint
  crop: TCoverImageCrop
  magnifier: TCoverMagnifier
  shadow: TCoverShadow
  borderRadius: number
  borderHighlight: TBorderHighlight
  size: TImageSize
  rotate: number
  glassBorder: TCoverGlassBorder
}

export type TCoverImages = Record<TCoverImageWhich, TCoverImageConfig | null>

export type TCoverImagePatch = Partial<
  Omit<
    TCoverImageConfig,
    'borderHighlight' | 'crop' | 'glassBorder' | 'magnifier' | 'shadow' | 'which'
  >
> & {
  crop?: Partial<TCoverImageCrop>
  borderHighlight?: Partial<TBorderHighlight>
  glassBorder?: Partial<TCoverGlassBorder>
  magnifier?: Partial<TCoverMagnifier>
  shadow?: Partial<TCoverShadow>
}

export type TCoverConfig = {
  canvasWidth: number
  canvasHeight: number
  images: TCoverImages
  background: TBgThemeConfig
}

export type TStore = {
  images: TCoverImages
  activeImageWhich: TCoverImageWhich
  canvasWidth: number
  canvasHeight: number
  background: TBgThemeConfig
  originalBackground: TBgThemeConfig

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
  images: TCoverImages
  activeImageWhich: TCoverImageWhich
  activeImage: TCoverImageConfig | null
  canvasWidth: number
  canvasHeight: number
  background: TBgThemeConfig
  activeBackground: TBgConfig
  isBackgroundTouched: boolean
}

export type TCoverBackgroundPatch = Partial<Omit<TBgConfig, 'effect' | 'pattern' | 'texture'>> & {
  effect?: Partial<TBgConfig['effect']>
  pattern?: Partial<TBgConfig['pattern']>
  texture?: Partial<TBgConfig['texture']>
}

export type TCoverBackgroundRange = TBgConfig['effect']

export type TCoverBackgroundGradientPatch = Partial<TGradientRecipe>

export type TCoverBackgroundTexturePatch = Partial<TBgConfig['texture']>
