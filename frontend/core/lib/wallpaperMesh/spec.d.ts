import type { TConstValues } from '~/spec'

import type {
  WALLPAPER_TEXTURE,
  WALLPAPER_TEXTURE_OPTIONS,
  WALLPAPER_TEXTURE_SURFACE,
} from './constant'

export type TMeshGradientAnchor = {
  x: number
  y: number
  color: number
}

export type TImageTextureType = TConstValues<typeof WALLPAPER_TEXTURE>

export type TWallpaperTexture = {
  type: TImageTextureType
  intensity: number
  params: Record<string, unknown>
}

export type TTextureSurface = TConstValues<typeof WALLPAPER_TEXTURE_SURFACE>

export type TTextureOption = (typeof WALLPAPER_TEXTURE_OPTIONS)[number]

export type TTextureSwatchPalette = {
  background: string
  mid: string
  edge: string
  digest: string
}

export type TMeshGradientRecipe = {
  version: 1
  kind: 'mesh'
  preset: string
  seed: number
  colors: string[]
  flow: number
  softness: number
  contrast: number
  brightness: number
  anchors: TMeshGradientAnchor[]
}
