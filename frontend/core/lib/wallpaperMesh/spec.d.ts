import type {
  GRADIENT_RENDERER,
  GRADIENT_SHAPE,
  MESH_GRADIENT_RENDERERS,
  WALLPAPER_GRADIENT_RENDERER_OPTIONS,
  WALLPAPER_TEXTURE,
  WALLPAPER_TEXTURE_OPTIONS,
  WALLPAPER_TEXTURE_SURFACE,
} from './constant'

export type TImageTextureType = WALLPAPER_TEXTURE

export type TWallpaperTexture = {
  type: TImageTextureType
  intensity: number
  params: Record<string, unknown>
}

export type TTextureSurface = WALLPAPER_TEXTURE_SURFACE

export type TTextureOption = (typeof WALLPAPER_TEXTURE_OPTIONS)[number]

export type TTextureSwatchPalette = {
  background: string
  mid: string
  edge: string
  digest: string
}

export type TGradientRenderer = GRADIENT_RENDERER
export type TMeshGradientRenderer = (typeof MESH_GRADIENT_RENDERERS)[number]
export type TGradientRendererOption = (typeof WALLPAPER_GRADIENT_RENDERER_OPTIONS)[number]

export type TMeshGradientRecipe = {
  version: 2
  renderer: TMeshGradientRenderer
  preset: string
  seed: number
  colors: string[]
  angle: number
  softness: number
  warp: number
  scale: number
  contrast: number
  brightness: number
}

export type TLinearGradientRecipe = {
  version: 2
  renderer: GRADIENT_RENDERER.LINEAR
  preset: string
  colors: string[]
  angle: number
  stops?: number[]
  spread: number
}

export type TRadialGradientRecipe = {
  version: 2
  renderer: GRADIENT_RENDERER.RADIAL
  preset: string
  colors: string[]
  angle?: number
  center: {
    x: number
    y: number
  }
  radius: number
  shape: GRADIENT_SHAPE
  stops?: number[]
  spread: number
}

export type TGradientRecipe = TLinearGradientRecipe | TRadialGradientRecipe | TMeshGradientRecipe
