import type { TConstValues } from '~/spec'

import type {
  GRADIENT_TYPE,
  MESH_GRADIENT_MODEL,
  WALLPAPER_TEXTURE,
  WALLPAPER_TEXTURE_OPTIONS,
  WALLPAPER_TEXTURE_SURFACE,
} from './constant'

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

export type TGradientType = TConstValues<typeof GRADIENT_TYPE>
export type TMeshGradientModel = TConstValues<typeof MESH_GRADIENT_MODEL>

export type TMeshGradientRecipe = {
  version: 2
  kind: typeof GRADIENT_TYPE.MESH
  preset: string
  model: TMeshGradientModel
  seed: number
  colors: string[]
  flow: number
  softness: number
  warp: number
  scale: number
  contrast: number
  brightness: number
}

export type TLinearGradientRecipe = {
  version: 1
  kind: typeof GRADIENT_TYPE.LINEAR
  preset: string
  colors: string[]
  angle: number
  stops?: number[]
  spread: number
}

export type TRadialGradientRecipe = {
  version: 1
  kind: typeof GRADIENT_TYPE.RADIAL
  preset: string
  colors: string[]
  center: {
    x: number
    y: number
  }
  radius: number
  shape: 'circle' | 'ellipse'
  stops?: number[]
  spread: number
}

export type TGradientRecipe = TLinearGradientRecipe | TRadialGradientRecipe | TMeshGradientRecipe
